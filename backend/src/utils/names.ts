// Name normalisation utilities.
// The CSV has inconsistencies: "Priya S", "priya", "rohan ", "Dev's friend Kabir".
// This module maps messy names to canonical user names.

/**
 * Normalise a raw name string:
 * - trim whitespace
 * - lowercase for comparison
 * - strip trailing initials (e.g. "Priya S" → "Priya")
 */
export function normaliseName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+[A-Z]\.?$/, '') // remove trailing initial like "S" or "S."
    .trim();
}

/**
 * Find a user from a list by fuzzy name match.
 * Returns the matched user or null.
 * Also returns a flag if the match was fuzzy (not exact).
 */
export function fuzzyMatchUser<T extends { name: string }>(
  rawName: string,
  users: T[]
): { user: T | null; isFuzzy: boolean; normalisedName: string } {
  const normalised = normaliseName(rawName);
  const lower = normalised.toLowerCase();

  // Exact match (case-insensitive)
  const exact = users.find((u) => u.name.toLowerCase() === lower);
  if (exact) return { user: exact, isFuzzy: false, normalisedName: normalised };

  // Prefix match: "Priya S" → matches "Priya"
  const prefix = users.find((u) => lower.startsWith(u.name.toLowerCase()));
  if (prefix) return { user: prefix, isFuzzy: true, normalisedName: normalised };

  // Contains match: user name appears within the raw string (e.g. "Dev's friend Kabir")
  // We do NOT auto-match here — this is flagged as an unknown member
  return { user: null, isFuzzy: false, normalisedName: normalised };
}
