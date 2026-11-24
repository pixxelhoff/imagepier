// Characters that make spreadsheets read a cell as a formula.
const FORMULA_START = ['=', '+', '-', '@', '\t', '\r'];

/** Quotes a CSV value; text that spreadsheets would read as a formula gets a leading apostrophe. */
export const toCsvValue = (value: string | number) => {
  if (typeof value === 'number') {
    return `"${value}"`;
  }

  const safe = FORMULA_START.some((start) => value.startsWith(start)) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** CSV for Excel: semicolon separated, CRLF line endings. */
export const toCsv = (rows: Array<Array<string | number>>) =>
  rows.map((row) => row.map((value) => toCsvValue(value)).join(';')).join('\r\n');
