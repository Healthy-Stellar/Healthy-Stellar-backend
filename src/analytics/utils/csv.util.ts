/**
 * Minimal CSV builder, following the manual-string-building pattern already
 * used in src/reports/reports.service.ts (no external CSV dependency).
 */
export class CsvUtil {
  static toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
    const header = columns.join(',');
    const lines = rows.map((row) => columns.map((col) => CsvUtil.escapeCell(row[col])).join(','));
    return [header, ...lines].join('\n') + (rows.length ? '\n' : '');
  }

  private static escapeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
