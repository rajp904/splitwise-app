// Split calculation engine.
// Given an expense and its split configuration, computes each person's share in INR.
// This is the core math of the app — called both by manual entry and CSV import.
//
// Split types:
//   equal      — total divided equally among all participants
//   unequal    — each person's fixed amount is specified explicitly
//   percentage — each person gets a % of the total
//   share      — each person gets (their units / total units) × total

import { SplitType } from '@prisma/client';
import { roundMoney, distributeEqually } from '../../utils/rounding';
import { AppError } from '../../middleware/errorHandler';

export interface SplitInput {
  userId: string;
  shareValue?: number; // null/undefined for equal split
}

export interface ComputedSplit {
  userId: string;
  shareValue: number | null;
  computedAmountInr: number;
}

/**
 * Compute the INR amount owed by each participant.
 *
 * @param totalInr   The expense total already converted to INR
 * @param splitType  One of: equal, unequal, percentage, share
 * @param splits     Array of { userId, shareValue } — shareValue meaning depends on splitType
 */
export function computeSplits(
  totalInr: number,
  splitType: SplitType,
  splits: SplitInput[]
): ComputedSplit[] {
  if (splits.length === 0) {
    throw new AppError(400, 'An expense must have at least one participant');
  }

  switch (splitType) {
    case 'equal':
      return computeEqualSplit(totalInr, splits);
    case 'unequal':
      return computeUnequalSplit(totalInr, splits);
    case 'percentage':
      return computePercentageSplit(totalInr, splits);
    case 'share':
      return computeShareSplit(totalInr, splits);
    default:
      throw new AppError(400, `Unknown split type: ${splitType}`);
  }
}

function computeEqualSplit(totalInr: number, splits: SplitInput[]): ComputedSplit[] {
  const amounts = distributeEqually(totalInr, splits.length);
  return splits.map((s, i) => ({
    userId: s.userId,
    shareValue: null,
    computedAmountInr: amounts[i],
  }));
}

function computeUnequalSplit(totalInr: number, splits: SplitInput[]): ComputedSplit[] {
  // Validate: the fixed amounts must sum to the total
  const sum = splits.reduce((acc, s) => acc + (s.shareValue ?? 0), 0);
  if (Math.abs(roundMoney(sum) - roundMoney(totalInr)) > 0.02) {
    throw new AppError(
      400,
      `Unequal split amounts sum to ${roundMoney(sum)} but expense total is ${roundMoney(totalInr)}`
    );
  }
  return splits.map((s) => ({
    userId: s.userId,
    shareValue: s.shareValue ?? null,
    computedAmountInr: roundMoney(s.shareValue ?? 0),
  }));
}

function computePercentageSplit(totalInr: number, splits: SplitInput[]): ComputedSplit[] {
  const totalPct = splits.reduce((acc, s) => acc + (s.shareValue ?? 0), 0);
  // Allow a small tolerance (0.1%) for rounding in user input
  if (Math.abs(totalPct - 100) > 0.1) {
    throw new AppError(
      400,
      `Percentages must sum to 100 (got ${totalPct}). Please adjust the percentages.`
    );
  }

  const computed = splits.map((s) => ({
    userId: s.userId,
    shareValue: s.shareValue ?? null,
    computedAmountInr: roundMoney(((s.shareValue ?? 0) / 100) * totalInr),
  }));

  // Fix rounding drift: adjust the first entry so total sums exactly
  const computedSum = computed.reduce((a, c) => a + c.computedAmountInr, 0);
  computed[0].computedAmountInr = roundMoney(computed[0].computedAmountInr + (totalInr - computedSum));

  return computed;
}

function computeShareSplit(totalInr: number, splits: SplitInput[]): ComputedSplit[] {
  const totalShares = splits.reduce((acc, s) => acc + (s.shareValue ?? 0), 0);
  if (totalShares <= 0) {
    throw new AppError(400, 'Total share units must be greater than 0');
  }

  const computed = splits.map((s) => ({
    userId: s.userId,
    shareValue: s.shareValue ?? null,
    computedAmountInr: roundMoney(((s.shareValue ?? 0) / totalShares) * totalInr),
  }));

  // Fix rounding drift
  const computedSum = computed.reduce((a, c) => a + c.computedAmountInr, 0);
  computed[0].computedAmountInr = roundMoney(computed[0].computedAmountInr + (totalInr - computedSum));

  return computed;
}
