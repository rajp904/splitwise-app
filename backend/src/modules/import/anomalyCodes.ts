// Every anomaly type the importer can detect, with its code, default severity, and policy.
// This is the single source of truth for anomaly handling — all policies are documented here.

export const ANOMALY_CODES = {
  A01_EXACT_DUPLICATE: {
    code: 'A01_EXACT_DUPLICATE',
    severity: 'warning' as const,
    policy: 'Auto-skip the second row. The first occurrence is imported. User can override.',
  },
  A02_SETTLEMENT_AS_EXPENSE: {
    code: 'A02_SETTLEMENT_AS_EXPENSE',
    severity: 'warning' as const,
    policy: 'Detect by blank split_type and/or settlement keywords in description/notes. Convert to a Settlement record instead of an Expense.',
  },
  A03_COMMA_IN_AMOUNT: {
    code: 'A03_COMMA_IN_AMOUNT',
    severity: 'info' as const,
    policy: 'Strip the comma and parse as a number. No user action required.',
  },
  A04_SUB_PAISA_PRECISION: {
    code: 'A04_SUB_PAISA_PRECISION',
    severity: 'info' as const,
    policy: 'Round to 2 decimal places using standard monetary rounding. No user action required.',
  },
  A05_NAME_MISMATCH: {
    code: 'A05_NAME_MISMATCH',
    severity: 'warning' as const,
    policy: 'Fuzzy-match to a known member. Flag the match so user can confirm. Import proceeds with matched user.',
  },
  A06_UNKNOWN_MEMBER: {
    code: 'A06_UNKNOWN_MEMBER',
    severity: 'warning' as const,
    policy: 'Create a guest user account for the unknown person. Flag for user review. Guest can be merged with a real account later.',
  },
  A07_CONFLICTING_DUPLICATE: {
    code: 'A07_CONFLICTING_DUPLICATE',
    severity: 'error' as const,
    policy: 'Hold both rows as PENDING. User must choose which row to keep before import can complete.',
  },
  A08_NONSTANDARD_DATE: {
    code: 'A08_NONSTANDARD_DATE',
    severity: 'warning' as const,
    policy: 'Parse using best-effort detection (e.g. "Mar-14" → March 14 of inferred year). Flag the interpretation so user can correct it.',
  },
  A09_MISSING_CURRENCY: {
    code: 'A09_MISSING_CURRENCY',
    severity: 'warning' as const,
    policy: 'Default to INR. Flag the assumption so user is aware.',
  },
  A10_ZERO_AMOUNT: {
    code: 'A10_ZERO_AMOUNT',
    severity: 'info' as const,
    policy: 'Skip the row. It is treated as a placeholder. Logged in the import report.',
  },
  A11_STALE_MEMBER_IN_SPLIT: {
    code: 'A11_STALE_MEMBER_IN_SPLIT',
    severity: 'warning' as const,
    policy: 'Remove the member from the split and recalculate. Their membership end date is earlier than the expense date. Flag so user can review.',
  },
  A12_AMBIGUOUS_DATE: {
    code: 'A12_AMBIGUOUS_DATE',
    severity: 'warning' as const,
    policy: 'Apply DD-MM-YYYY convention (the app\'s documented primary format). Flag the ambiguity so user can correct if needed.',
  },
  A13_PERCENTAGE_NOT_100: {
    code: 'A13_PERCENTAGE_NOT_100',
    severity: 'error' as const,
    policy: 'Flag and hold as PENDING. User must correct the percentages before the row can be imported. Auto-normalisation is NOT applied to avoid silently changing intent.',
  },
  A14_SPLIT_TYPE_DETAILS_CONFLICT: {
    code: 'A14_SPLIT_TYPE_DETAILS_CONFLICT',
    severity: 'warning' as const,
    policy: 'split_type field wins. The conflicting split_details are ignored. Flag so user is aware.',
  },
  A15_MISSING_PAYER: {
    code: 'A15_MISSING_PAYER',
    severity: 'error' as const,
    policy: 'Cannot import a row with no payer. Hold as PENDING and require user to specify payer.',
  },
  A16_NEGATIVE_AMOUNT: {
    code: 'A16_NEGATIVE_AMOUNT',
    severity: 'info' as const,
    policy: 'Treat as a refund. Import as a regular expense with negative amount. The refund reduces the group\'s total expenditure.',
  },
  A17_MEMBER_NOT_JOINED: {
    code: 'A17_MEMBER_NOT_JOINED',
    severity: 'error' as const,
    policy: 'The participant listed had not yet joined the group on the expense date. Remove them from the split and recalculate. Hold as PENDING if removal leaves no valid participants.',
  },
  A18_INVALID_CURRENCY: {
    code: 'A18_INVALID_CURRENCY',
    severity: 'error' as const,
    policy: 'Only INR and USD are supported. An unrecognised currency code cannot be converted to INR for balance calculation. Hold row as PENDING. User must correct the currency.',
  },
  A19_MISSING_PARTICIPANTS: {
    code: 'A19_MISSING_PARTICIPANTS',
    severity: 'error' as const,
    policy: 'The split_with field is empty. An expense must have at least one participant. Hold row as PENDING.',
  },
} as const;

export type AnomalyCode = keyof typeof ANOMALY_CODES;
