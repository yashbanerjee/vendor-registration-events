const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeSpreadsheetCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map((column) => escapeSpreadsheetCell(column)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeSpreadsheetCell(row[column])).join(","));
  return [header, ...body].join("\r\n");
}

export const VENDOR_IMPORT_COLUMNS = [
  "reference",
  "companyName",
  "contactName",
  "email",
  "additionalEmails",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country",
  "category",
] as const;
