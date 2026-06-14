// Date parsing utilities.
// The CSV has multiple date formats. This module normalises all of them.
// Documented convention: DD-MM-YYYY is the primary format for this app.

/**
 * Attempt to parse a date string from multiple known formats.
 * Returns a Date object or null if parsing fails.
 * Also returns a flag if the format was non-standard (for anomaly reporting).
 */
export function parseFlexibleDate(
  raw: string,
  contextYear?: number
): { date: Date | null; isAmbiguous: boolean; formatDetected: string } {
  const s = raw.trim();
  const year = contextYear ?? new Date().getFullYear();

  // Format 1: DD-MM-YYYY (primary app format, e.g. "08-02-2026")
  const ddmmyyyy = s.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`);
    if (!isNaN(date.getTime())) {
      return { date, isAmbiguous: false, formatDetected: 'DD-MM-YYYY' };
    }
  }

  // Format 2: Mon-DD (e.g. "Mar-14") — year is inferred from context
  const mondd = s.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (mondd) {
    const [, mon, day] = mondd;
    const date = new Date(`${mon} ${day}, ${year} UTC`);
    if (!isNaN(date.getTime())) {
      return { date, isAmbiguous: true, formatDetected: 'Mon-DD (year inferred)' };
    }
  }

  // Format 3: MM-DD-YYYY — ambiguous with DD-MM-YYYY when day ≤ 12
  // We do NOT auto-detect this. If DD-MM-YYYY fails, flag as error.
  return { date: null, isAmbiguous: true, formatDetected: 'unknown' };
}

/**
 * Format a Date as YYYY-MM-DD for database storage.
 */
export function toDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Check if dateA is strictly before dateB (ignoring time).
 */
export function isBefore(dateA: Date, dateB: Date): boolean {
  return dateA.getTime() < dateB.getTime();
}
