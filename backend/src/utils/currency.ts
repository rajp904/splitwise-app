// Currency conversion utilities.
// The app stores all balances in INR for consistent comparison.
// Exchange rates are stored in the DB; this module does the math.

import prisma from '../config/prisma';
import { roundMoney } from './rounding';

/**
 * Convert an amount from one currency to INR using the stored exchange rate.
 * Looks up the most recent rate effective on or before the given date.
 */
export async function convertToInr(
  amount: number,
  fromCurrency: string,
  onDate: Date
): Promise<number> {
  if (fromCurrency === 'INR') return roundMoney(amount);

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency: 'INR',
      effectiveDate: { lte: onDate },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!rate) {
    throw new Error(
      `No exchange rate found for ${fromCurrency} → INR on or before ${onDate.toISOString().slice(0, 10)}`
    );
  }

  return roundMoney(amount * Number(rate.rate));
}

/**
 * Get all available exchange rates (for display in the UI).
 */
export async function getAllRates() {
  return prisma.exchangeRate.findMany({
    orderBy: [{ fromCurrency: 'asc' }, { effectiveDate: 'desc' }],
  });
}

export const SUPPORTED_CURRENCIES = ['INR', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(code as SupportedCurrency);
}
