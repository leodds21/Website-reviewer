export type CsvCell = string | number | null;

// A cell starting with one of these runs as a formula in a spreadsheet.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell, separator: string): string {
  if (value === null) return "";
  let text = String(value);
  // Domains and findings come from other people's sites.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 CSV. Excel in Portuguese expects ";" between columns, so the
 * separator follows the page's language.
 */
export function toCsv(rows: CsvCell[][], separator: "," | ";" = ","): string {
  return rows.map((row) => row.map((value) => cell(value, separator)).join(separator)).join("\r\n");
}
