// Validator — Step 2 of the import pipeline.
// Runs each raw row through every anomaly check.
// Does NOT write to the DB. Returns an array of DetectedAnomaly objects.

import { ANOMALY_CODES } from './anomalyCodes';
import { RawCsvRow } from './parser';
import { parseFlexibleDate } from '../../utils/dates';
import { fuzzyMatchUser } from '../../utils/names';

export interface KnownUser {
  id: string;
  name: string;
}

export interface MembershipRecord {
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface DetectedAnomaly {
  rowIndex: number;
  anomalyCode: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
  resolutionPolicy: string;
  suggestedFix?: Record<string, unknown>; // hints for the resolver
}

export interface ValidatedRow {
  rawRow: RawCsvRow;
  anomalies: DetectedAnomaly[];
  // Parsed values (best-effort — may still be null if unresolvable)
  parsedDate: Date | null;
  parsedAmount: number | null;
  parsedCurrency: string;
  parsedPayer: KnownUser | null;
  payerRaw: string;
  parsedSplitType: string;
  parsedParticipants: Array<{ raw: string; matched: KnownUser | null; isFuzzy: boolean }>;
  parsedSplitDetails: Array<{ name: string; value: number }>;
  isSettlement: boolean;
  shouldSkip: boolean;  // true for zero-amount rows etc.
}

const SETTLEMENT_KEYWORDS = ['paid back', 'settlement', 'settled', 'repaid', 'reimburs'];

export function validateRows(
  rows: RawCsvRow[],
  knownUsers: KnownUser[],
  memberships: MembershipRecord[],
  contextYear: number
): ValidatedRow[] {
  const validated: ValidatedRow[] = rows.map((row) =>
    validateSingleRow(row, knownUsers, memberships, contextYear)
  );

  // Cross-row checks: duplicates (need all rows to compare)
  detectDuplicates(validated);

  return validated;
}

function validateSingleRow(
  row: RawCsvRow,
  knownUsers: KnownUser[],
  memberships: MembershipRecord[],
  contextYear: number
): ValidatedRow {
  const anomalies: DetectedAnomaly[] = [];

  // ── Date ──────────────────────────────────────────────────────────────────
  const { date: parsedDate, isAmbiguous, formatDetected } = parseFlexibleDate(row.date, contextYear);

  if (!parsedDate) {
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A08_NONSTANDARD_DATE.code,
      severity: ANOMALY_CODES.A08_NONSTANDARD_DATE.severity,
      description: `Cannot parse date "${row.date}". Expected format DD-MM-YYYY.`,
      resolutionPolicy: ANOMALY_CODES.A08_NONSTANDARD_DATE.policy,
    });
  } else if (isAmbiguous) {
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A08_NONSTANDARD_DATE.code,
      severity: ANOMALY_CODES.A08_NONSTANDARD_DATE.severity,
      description: `Non-standard date format "${row.date}" (detected as ${formatDetected}). Interpreted as ${parsedDate.toISOString().slice(0, 10)}.`,
      resolutionPolicy: ANOMALY_CODES.A08_NONSTANDARD_DATE.policy,
    });
  }

  // ── Amount ────────────────────────────────────────────────────────────────
  let parsedAmount: number | null = null;
  const rawAmount = row.amount;

  if (!rawAmount || rawAmount.trim() === '') {
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A15_MISSING_PAYER.code, // reuse error severity
      severity: 'error',
      description: 'Amount field is empty.',
      resolutionPolicy: 'Row cannot be imported without an amount.',
    });
  } else {
    // A03: comma in amount
    const hasComma = rawAmount.includes(',');
    const cleanAmount = rawAmount.replace(/,/g, '');
    parsedAmount = parseFloat(cleanAmount);

    if (hasComma) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A03_COMMA_IN_AMOUNT.code,
        severity: ANOMALY_CODES.A03_COMMA_IN_AMOUNT.severity,
        description: `Amount "${rawAmount}" contains commas. Parsed as ${parsedAmount}.`,
        resolutionPolicy: ANOMALY_CODES.A03_COMMA_IN_AMOUNT.policy,
      });
    }

    if (isNaN(parsedAmount)) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: 'A_INVALID_AMOUNT',
        severity: 'error',
        description: `Amount "${rawAmount}" is not a valid number.`,
        resolutionPolicy: 'Row cannot be imported. Please correct the amount.',
      });
      parsedAmount = null;
    } else if (parsedAmount === 0) {
      // A10: zero amount
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A10_ZERO_AMOUNT.code,
        severity: ANOMALY_CODES.A10_ZERO_AMOUNT.severity,
        description: `Amount is 0. "${row.notes || 'No notes'}". This row will be skipped.`,
        resolutionPolicy: ANOMALY_CODES.A10_ZERO_AMOUNT.policy,
      });
    } else if (parsedAmount < 0) {
      // A16: negative amount (refund)
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A16_NEGATIVE_AMOUNT.code,
        severity: ANOMALY_CODES.A16_NEGATIVE_AMOUNT.severity,
        description: `Amount is negative (${parsedAmount}). Treated as a refund.`,
        resolutionPolicy: ANOMALY_CODES.A16_NEGATIVE_AMOUNT.policy,
      });
    } else {
      // A04: sub-paisa precision
      const rounded = Math.round(parsedAmount * 100) / 100;
      if (parsedAmount !== rounded) {
        anomalies.push({
          rowIndex: row.rowIndex,
          anomalyCode: ANOMALY_CODES.A04_SUB_PAISA_PRECISION.code,
          severity: ANOMALY_CODES.A04_SUB_PAISA_PRECISION.severity,
          description: `Amount ${parsedAmount} has sub-paisa precision. Rounded to ${rounded}.`,
          resolutionPolicy: ANOMALY_CODES.A04_SUB_PAISA_PRECISION.policy,
        });
        parsedAmount = rounded;
      }
    }
  }

  // ── Currency ──────────────────────────────────────────────────────────────
  const SUPPORTED_CURRENCIES = ['INR', 'USD'];
  let parsedCurrency = (row.currency || '').trim().toUpperCase();
  if (!parsedCurrency) {
    parsedCurrency = 'INR';
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A09_MISSING_CURRENCY.code,
      severity: ANOMALY_CODES.A09_MISSING_CURRENCY.severity,
      description: 'Currency field is empty. Defaulting to INR.',
      resolutionPolicy: ANOMALY_CODES.A09_MISSING_CURRENCY.policy,
    });
  } else if (!SUPPORTED_CURRENCIES.includes(parsedCurrency)) {
    // A18: unrecognised currency — cannot convert to INR, must block
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A18_INVALID_CURRENCY.code,
      severity: ANOMALY_CODES.A18_INVALID_CURRENCY.severity,
      description: `Currency "${parsedCurrency}" is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}. Cannot convert to INR.`,
      resolutionPolicy: ANOMALY_CODES.A18_INVALID_CURRENCY.policy,
    });
  }

  // ── Settlement detection ──────────────────────────────────────────────────
  const descLower = (row.description + ' ' + row.notes).toLowerCase();
  const isSettlement =
    !row.split_type &&
    SETTLEMENT_KEYWORDS.some((kw) => descLower.includes(kw));

  // ── Payer ─────────────────────────────────────────────────────────────────
  let parsedPayer: KnownUser | null = null;
  let payerRaw = row.paid_by;

  if (!row.paid_by || row.paid_by.trim() === '') {
    if (!isSettlement) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A15_MISSING_PAYER.code,
        severity: ANOMALY_CODES.A15_MISSING_PAYER.severity,
        description: 'Payer (paid_by) field is empty.',
        resolutionPolicy: ANOMALY_CODES.A15_MISSING_PAYER.policy,
      });
    }
  } else {
    const { user, isFuzzy, normalisedName } = fuzzyMatchUser(row.paid_by, knownUsers);
    parsedPayer = user;
    payerRaw = normalisedName;

    if (!user) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A06_UNKNOWN_MEMBER.code,
        severity: ANOMALY_CODES.A06_UNKNOWN_MEMBER.severity,
        description: `Payer "${row.paid_by}" is not a known group member. A guest account will be created.`,
        resolutionPolicy: ANOMALY_CODES.A06_UNKNOWN_MEMBER.policy,
        suggestedFix: { createGuest: true, name: normalisedName },
      });
    } else if (isFuzzy) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A05_NAME_MISMATCH.code,
        severity: ANOMALY_CODES.A05_NAME_MISMATCH.severity,
        description: `Payer "${row.paid_by}" fuzzy-matched to "${user.name}".`,
        resolutionPolicy: ANOMALY_CODES.A05_NAME_MISMATCH.policy,
        suggestedFix: { matchedUserId: user.id, matchedName: user.name },
      });
    }
  }

  // ── Split type ────────────────────────────────────────────────────────────
  const validSplitTypes = ['equal', 'unequal', 'percentage', 'share'];
  const parsedSplitType = row.split_type?.trim().toLowerCase() ?? '';

  // ── Participants ──────────────────────────────────────────────────────────
  const participantRaws = row.split_with
    ? row.split_with.split(';').map((n) => n.trim()).filter(Boolean)
    : [];

  const parsedParticipants = participantRaws.map((raw) => {
    const { user, isFuzzy, normalisedName } = fuzzyMatchUser(raw, knownUsers);
    if (!user) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A06_UNKNOWN_MEMBER.code,
        severity: ANOMALY_CODES.A06_UNKNOWN_MEMBER.severity,
        description: `Participant "${raw}" is not a known group member. A guest account will be created.`,
        resolutionPolicy: ANOMALY_CODES.A06_UNKNOWN_MEMBER.policy,
        suggestedFix: { createGuest: true, name: normalisedName },
      });
    } else if (isFuzzy && !anomalies.some((a) => a.anomalyCode === ANOMALY_CODES.A05_NAME_MISMATCH.code && a.description.includes(raw))) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A05_NAME_MISMATCH.code,
        severity: ANOMALY_CODES.A05_NAME_MISMATCH.severity,
        description: `Participant "${raw}" fuzzy-matched to "${user.name}".`,
        resolutionPolicy: ANOMALY_CODES.A05_NAME_MISMATCH.policy,
      });
    }
    return { raw, matched: user, isFuzzy };
  });

  // ── Missing participants check (A19) ─────────────────────────────────────
  // Must happen after participants are parsed so we know the final list.
  // A settlement has no split_with — skip this check for settlements.
  if (!isSettlement && participantRaws.length === 0) {
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A19_MISSING_PARTICIPANTS.code,
      severity: ANOMALY_CODES.A19_MISSING_PARTICIPANTS.severity,
      description: 'The split_with field is empty. An expense must have at least one participant.',
      resolutionPolicy: ANOMALY_CODES.A19_MISSING_PARTICIPANTS.policy,
    });
  }

  // ── Stale member check (leftAt) + Early member check (joinedAt) ───────────
  if (parsedDate) {
    for (const participant of parsedParticipants) {
      if (!participant.matched) continue;
      const membership = memberships.find((m) => m.userId === participant.matched!.id);
      if (!membership) continue;

      // A11: charged after leaving
      if (membership.leftAt && parsedDate > membership.leftAt) {
        anomalies.push({
          rowIndex: row.rowIndex,
          anomalyCode: ANOMALY_CODES.A11_STALE_MEMBER_IN_SPLIT.code,
          severity: ANOMALY_CODES.A11_STALE_MEMBER_IN_SPLIT.severity,
          description: `"${participant.matched.name}" left the group on ${membership.leftAt.toISOString().slice(0, 10)} but is listed in this expense dated ${parsedDate.toISOString().slice(0, 10)}.`,
          resolutionPolicy: ANOMALY_CODES.A11_STALE_MEMBER_IN_SPLIT.policy,
          suggestedFix: { removeUserId: participant.matched.id },
        });
      }

      // A17: charged before joining
      if (parsedDate < membership.joinedAt) {
        anomalies.push({
          rowIndex: row.rowIndex,
          anomalyCode: ANOMALY_CODES.A17_MEMBER_NOT_JOINED.code,
          severity: ANOMALY_CODES.A17_MEMBER_NOT_JOINED.severity,
          description: `"${participant.matched.name}" joined the group on ${membership.joinedAt.toISOString().slice(0, 10)} but is listed in this expense dated ${parsedDate.toISOString().slice(0, 10)}, which is before they joined.`,
          resolutionPolicy: ANOMALY_CODES.A17_MEMBER_NOT_JOINED.policy,
          suggestedFix: { removeUserId: participant.matched.id },
        });
      }
    }
  }

  // ── Split details parsing ─────────────────────────────────────────────────
  const parsedSplitDetails: Array<{ name: string; value: number }> = [];
  if (row.split_details) {
    const parts = row.split_details.split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      // "Rohan 700" or "Aisha 30%"
      const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
      if (match) {
        parsedSplitDetails.push({ name: match[1].trim(), value: parseFloat(match[2]) });
      }
    }
  }

  // ── Percentage sum check ──────────────────────────────────────────────────
  if (parsedSplitType === 'percentage' && parsedSplitDetails.length > 0) {
    const totalPct = parsedSplitDetails.reduce((sum, d) => sum + d.value, 0);
    if (Math.abs(totalPct - 100) > 0.1) {
      anomalies.push({
        rowIndex: row.rowIndex,
        anomalyCode: ANOMALY_CODES.A13_PERCENTAGE_NOT_100.code,
        severity: ANOMALY_CODES.A13_PERCENTAGE_NOT_100.severity,
        description: `Percentages sum to ${totalPct}%, not 100%. Cannot import without correction.`,
        resolutionPolicy: ANOMALY_CODES.A13_PERCENTAGE_NOT_100.policy,
      });
    }
  }

  // ── split_type vs split_details conflict (A14) ───────────────────────────
  if (parsedSplitType === 'equal' && parsedSplitDetails.length > 0) {
    // e.g. "Furniture for common room": split_type=equal but share-style details present
    anomalies.push({
      rowIndex: row.rowIndex,
      anomalyCode: ANOMALY_CODES.A14_SPLIT_TYPE_DETAILS_CONFLICT.code,
      severity: ANOMALY_CODES.A14_SPLIT_TYPE_DETAILS_CONFLICT.severity,
      description: `split_type is "equal" but split_details "${row.split_details}" look like share/unequal values. split_type wins; details ignored.`,
      resolutionPolicy: ANOMALY_CODES.A14_SPLIT_TYPE_DETAILS_CONFLICT.policy,
    });
  }

  const shouldSkip = parsedAmount === 0;

  return {
    rawRow: row,
    anomalies,
    parsedDate,
    parsedAmount,
    parsedCurrency,
    parsedPayer,
    payerRaw,
    parsedSplitType,
    parsedParticipants,
    parsedSplitDetails,
    isSettlement,
    shouldSkip,
  };
}

/**
 * Cross-row duplicate detection.
 * Runs after all rows are validated individually.
 */
function detectDuplicates(rows: ValidatedRow[]): void {
  const seen = new Map<string, number>(); // key → first rowIndex

  for (const row of rows) {
    if (!row.parsedDate || row.parsedAmount === null) continue;

    // Exact duplicate key: date + payer + amount + description (normalised)
    const exactKey = [
      row.parsedDate.toISOString().slice(0, 10),
      row.parsedPayer?.id ?? row.payerRaw.toLowerCase(),
      row.parsedAmount,
      row.rawRow.description.toLowerCase().trim(),
    ].join('|');

    if (seen.has(exactKey)) {
      row.anomalies.push({
        rowIndex: row.rawRow.rowIndex,
        anomalyCode: ANOMALY_CODES.A01_EXACT_DUPLICATE.code,
        severity: ANOMALY_CODES.A01_EXACT_DUPLICATE.severity,
        description: `Exact duplicate of row ${seen.get(exactKey)! + 1} (same date, payer, amount, and description). This row will be skipped.`,
        resolutionPolicy: ANOMALY_CODES.A01_EXACT_DUPLICATE.policy,
      });
      row.shouldSkip = true;
    } else {
      seen.set(exactKey, row.rawRow.rowIndex);
    }

    // Near-duplicate key: same date + payer + similar description, different amount
    const nearKey = [
      row.parsedDate.toISOString().slice(0, 10),
      row.parsedPayer?.id ?? row.payerRaw.toLowerCase(),
      // Normalise description: lowercase, remove common words
      row.rawRow.description.toLowerCase().replace(/[-_\s]+/g, ' ').trim(),
    ].join('|');

    // Check against existing entries with same near-key but different amount
    for (const [key, firstIdx] of seen.entries()) {
      const parts = key.split('|');
      const nearParts = nearKey.split('|');
      if (parts[0] === nearParts[0] && parts[1] === nearParts[1] && parts[2] !== nearParts[2]) {
        // Different description normalisation — not a near-duplicate by this logic
        continue;
      }
      if (key !== exactKey && parts[0] === nearParts[0] && parts[1] === nearParts[1]) {
        // Same date + payer, different description — check similarity
        const descSimilarity = descriptionSimilarity(parts[2] ?? '', nearParts[2] ?? '');
        if (descSimilarity > 0.7) {
          row.anomalies.push({
            rowIndex: row.rawRow.rowIndex,
            anomalyCode: ANOMALY_CODES.A07_CONFLICTING_DUPLICATE.code,
            severity: ANOMALY_CODES.A07_CONFLICTING_DUPLICATE.severity,
            description: `Possible duplicate of row ${firstIdx + 1} (same date and payer, similar description but different amount). User must choose which row to keep.`,
            resolutionPolicy: ANOMALY_CODES.A07_CONFLICTING_DUPLICATE.policy,
          });
        }
      }
    }
  }
}

/** Simple character-overlap similarity ratio between two strings (0–1). */
function descriptionSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
