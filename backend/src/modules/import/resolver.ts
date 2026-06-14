// Resolver — Step 3 of the import pipeline.
// Takes validated rows and anomaly list, applies policies, writes to DB.
// Returns a summary of what happened to each row.

import prisma from '../../config/prisma';
import { ValidatedRow } from './validator';
import { createExpense } from '../expenses/expenses.service';
import { createSettlement } from '../settlements/settlements.service';
import { SplitType } from '@prisma/client';
import { roundMoney } from '../../utils/rounding';

export interface ResolvedRow {
  rowIndex: number;
  action: 'imported' | 'skipped' | 'pending' | 'error';
  reason: string;
  expenseId?: string;
  settlementId?: string;
  anomalyCodes: string[];
}

interface ResolveOptions {
  sessionId: string;
  groupId: string;
  importedById: string;
  rows: ValidatedRow[];
  // Guest users created during this session: name → userId
  guestUserMap: Map<string, string>;
}

export async function resolveRows(options: ResolveOptions): Promise<ResolvedRow[]> {
  const { rows, groupId, importedById, sessionId, guestUserMap } = options;
  const results: ResolvedRow[] = [];

  for (const row of rows) {
    const rowResult = await resolveOneRow(row, groupId, importedById, sessionId, guestUserMap);
    results.push(rowResult);
  }

  return results;
}

async function resolveOneRow(
  row: ValidatedRow,
  groupId: string,
  importedById: string,
  sessionId: string,
  guestUserMap: Map<string, string>
): Promise<ResolvedRow> {
  const { rawRow, anomalies } = row;
  const anomalyCodes = anomalies.map((a) => a.anomalyCode);

  // SKIP zero-amount rows
  if (row.shouldSkip && row.parsedAmount === 0) {
    await recordAnomaly(sessionId, row, anomalies, 'skipped: zero amount placeholder row', null);
    return { rowIndex: rawRow.rowIndex, action: 'skipped', reason: 'Zero-amount placeholder row', anomalyCodes };
  }

  // SKIP exact duplicates
  if (anomalyCodes.includes('A01_EXACT_DUPLICATE')) {
    await recordAnomaly(sessionId, row, anomalies, 'skipped: exact duplicate of earlier row', null);
    return { rowIndex: rawRow.rowIndex, action: 'skipped', reason: 'Exact duplicate', anomalyCodes };
  }

  // HOLD rows with error-severity anomalies for user confirmation
  const hasBlockingError = anomalies.some(
    (a) => a.severity === 'error' &&
      !['A16_NEGATIVE_AMOUNT'].includes(a.anomalyCode) // refunds are errors but not blocking
  );
  if (hasBlockingError) {
    await recordAnomaly(sessionId, row, anomalies, 'pending: requires user review', null);
    return {
      rowIndex: rawRow.rowIndex,
      action: 'pending',
      reason: anomalies.filter((a) => a.severity === 'error').map((a) => a.description).join('; '),
      anomalyCodes,
    };
  }

  // SETTLEMENT conversion
  if (row.isSettlement) {
    return await resolveAsSettlement(row, groupId, importedById, sessionId, guestUserMap, anomalyCodes);
  }

  // Normal expense
  return await resolveAsExpense(row, groupId, importedById, sessionId, guestUserMap, anomalyCodes);
}

async function resolveAsSettlement(
  row: ValidatedRow,
  groupId: string,
  importedById: string,
  sessionId: string,
  guestUserMap: Map<string, string>,
  anomalyCodes: string[]
): Promise<ResolvedRow> {
  try {
    if (!row.parsedDate || !row.parsedPayer || !row.parsedAmount) {
      throw new Error('Missing required fields for settlement');
    }

    // For settlement: payer is the person who paid, first participant is who they paid
    const payeeRaw = row.rawRow.split_with?.split(';')[0]?.trim() ?? '';
    const payeeId = resolveUserId(payeeRaw, row.parsedParticipants, guestUserMap);
    if (!payeeId) throw new Error(`Cannot resolve payee "${payeeRaw}"`);

    const settlement = await createSettlement({
      groupId,
      paidById: row.parsedPayer.id,
      paidToId: payeeId,
      amount: Math.abs(row.parsedAmount),
      currency: row.parsedCurrency,
      settlementDate: row.parsedDate,
      notes: row.rawRow.notes,
      createdById: importedById,
    });

    await recordAnomaly(sessionId, row, row.anomalies, `imported as settlement: ${settlement.id}`, null);
    return {
      rowIndex: row.rawRow.rowIndex,
      action: 'imported',
      reason: 'Converted from settlement-type row',
      settlementId: settlement.id,
      anomalyCodes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordAnomaly(sessionId, row, row.anomalies, `error: ${msg}`, null);
    return { rowIndex: row.rawRow.rowIndex, action: 'error', reason: msg, anomalyCodes };
  }
}

async function resolveAsExpense(
  row: ValidatedRow,
  groupId: string,
  importedById: string,
  sessionId: string,
  guestUserMap: Map<string, string>,
  anomalyCodes: string[]
): Promise<ResolvedRow> {
  try {
    if (!row.parsedDate || !row.parsedPayer || row.parsedAmount === null) {
      throw new Error('Missing required fields for expense');
    }

    // Resolve split type — default to equal if missing
    const splitTypeRaw = row.parsedSplitType || 'equal';
    const splitType = splitTypeRaw as SplitType;

    // Build participant list, removing stale members (left before expense) and
    // pre-join members (hadn't joined yet on expense date). Both use the same
    // suggestedFix shape: { removeUserId }.
    const staleUserIds = row.anomalies
      .filter((a) =>
        a.anomalyCode === 'A11_STALE_MEMBER_IN_SPLIT' ||
        a.anomalyCode === 'A17_MEMBER_NOT_JOINED'
      )
      .map((a) => (a.suggestedFix as { removeUserId: string })?.removeUserId)
      .filter(Boolean);

    const activeParticipants = row.parsedParticipants.filter(
      (p) => p.matched && !staleUserIds.includes(p.matched.id)
    );

    // If all participants were stale, fall back to just the payer
    const participants =
      activeParticipants.length > 0 ? activeParticipants : [{ matched: row.parsedPayer, raw: row.parsedPayer.name, isFuzzy: false }];

    // Build splits array
    const splits = buildSplits(splitType, participants, row.parsedSplitDetails, guestUserMap, row.parsedAmount);

    const expense = await createExpense({
      groupId,
      description: row.rawRow.description,
      amount: Math.abs(row.parsedAmount), // handle refunds: store as positive with negative note
      currency: row.parsedCurrency,
      paidById: row.parsedPayer.id,
      splitType,
      expenseDate: row.parsedDate,
      splits,
      notes: row.rawRow.notes,
      createdById: importedById,
      importRowIndex: row.rawRow.rowIndex,
    });

    await recordAnomaly(sessionId, row, row.anomalies, `imported as expense: ${expense.id}`, expense.id);
    return {
      rowIndex: row.rawRow.rowIndex,
      action: 'imported',
      reason: 'Successfully imported',
      expenseId: expense.id,
      anomalyCodes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordAnomaly(sessionId, row, row.anomalies, `error: ${msg}`, null);
    return { rowIndex: row.rawRow.rowIndex, action: 'error', reason: msg, anomalyCodes };
  }
}

function buildSplits(
  splitType: SplitType,
  participants: Array<{ matched: { id: string; name: string } | null; raw: string; isFuzzy: boolean }>,
  splitDetails: Array<{ name: string; value: number }>,
  guestUserMap: Map<string, string>,
  totalAmount: number
): Array<{ userId: string; shareValue?: number }> {
  const validParticipants = participants.filter((p) => p.matched !== null);

  if (splitType === 'equal') {
    return validParticipants.map((p) => ({ userId: p.matched!.id }));
  }

  if (splitType === 'unequal' || splitType === 'percentage' || splitType === 'share') {
    // Map split_details values to participant userIds
    return validParticipants.map((p) => {
      const detail = splitDetails.find(
        (d) => d.name.toLowerCase() === p.matched!.name.toLowerCase() ||
               d.name.toLowerCase() === p.raw.toLowerCase()
      );
      return {
        userId: p.matched!.id,
        shareValue: detail?.value,
      };
    });
  }

  // Default fallback
  return validParticipants.map((p) => ({ userId: p.matched!.id }));
}

function resolveUserId(
  raw: string,
  participants: ValidatedRow['parsedParticipants'],
  guestUserMap: Map<string, string>
): string | null {
  const match = participants.find((p) => p.raw.toLowerCase() === raw.toLowerCase() || p.matched?.name.toLowerCase() === raw.toLowerCase());
  if (match?.matched) return match.matched.id;
  return guestUserMap.get(raw.toLowerCase()) ?? null;
}

async function recordAnomaly(
  sessionId: string,
  row: ValidatedRow,
  anomalies: ValidatedRow['anomalies'],
  actionTaken: string,
  resultingExpenseId: string | null
): Promise<void> {
  if (anomalies.length === 0) return;

  // Write all anomalies for this row in parallel
  await Promise.all(
    anomalies.map((a) =>
      prisma.importAnomaly.create({
        data: {
          sessionId,
          rowIndex: row.rawRow.rowIndex,
          rawRow: row.rawRow as unknown as import('@prisma/client').Prisma.InputJsonValue,
          anomalyCode: a.anomalyCode,
          severity: a.severity,
          description: a.description,
          resolutionPolicy: a.resolutionPolicy,
          actionTaken,
          resultingExpenseId,
        },
      })
    )
  );
}
