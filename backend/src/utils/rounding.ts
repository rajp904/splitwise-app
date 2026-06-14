// Single source of truth for rounding.
// All monetary amounts are rounded to 2 decimal places (paise).
// We use "round half up" (standard arithmetic rounding) consistently.
// If you need to change the rounding rule, change it here only.

/**
 * Round a number to 2 decimal places (standard monetary rounding).
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round a number to N decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Distribute a total amount among N people as evenly as possible.
 * The remainder (from rounding) is added to the first person's share.
 * Returns an array of amounts that sum exactly to total.
 *
 * Example: ₹100 split 3 ways → [33.34, 33.33, 33.33]
 */
export function distributeEqually(totalInr: number, count: number): number[] {
  if (count <= 0) throw new Error('Cannot split among 0 people');
  const base = Math.floor((totalInr * 100) / count) / 100;
  const remainder = roundMoney(totalInr - base * count);
  const shares = Array(count).fill(base) as number[];
  // Add the remainder (in paise) to the first person
  shares[0] = roundMoney(shares[0] + remainder);
  return shares;
}
