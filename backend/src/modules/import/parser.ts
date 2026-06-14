// CSV Parser — Step 1 of the import pipeline.
// Reads the raw CSV bytes and returns an array of plain objects.
// No validation, no interpretation — just raw rows.
// We preserve the original row content for anomaly reporting.

import { parse } from 'csv-parse';

export interface RawCsvRow {
  rowIndex: number;           // 0-based row index (excluding header)
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

/**
 * Parse a CSV buffer into raw row objects.
 * Returns the rows and any parse-level errors (e.g. malformed CSV structure).
 */
export async function parseCsv(buffer: Buffer): Promise<RawCsvRow[]> {
  return new Promise((resolve, reject) => {
    parse(
      buffer,
      {
        columns: true,          // use first row as header names
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // don't error on rows with mismatched column counts
      },
      (err, records: Record<string, string>[]) => {
        if (err) {
          reject(new Error(`CSV parse error: ${err.message}`));
          return;
        }

        const rows: RawCsvRow[] = records.map((record, index) => ({
          rowIndex: index,
          date: record['date'] ?? '',
          description: record['description'] ?? '',
          paid_by: record['paid_by'] ?? '',
          amount: record['amount'] ?? '',
          currency: record['currency'] ?? '',
          split_type: record['split_type'] ?? '',
          split_with: record['split_with'] ?? '',
          split_details: record['split_details'] ?? '',
          notes: record['notes'] ?? '',
        }));

        resolve(rows);
      }
    );
  });
}
