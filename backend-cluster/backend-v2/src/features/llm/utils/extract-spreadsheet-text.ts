import * as XLSX from "xlsx";

const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const MAX_SHEETS = 25;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;

function getSheetRowCount(sheet: XLSX.WorkSheet): number {
  const reference = sheet["!fullref"] ?? sheet["!ref"];
  if (!reference) return 0;
  const range = XLSX.utils.decode_range(reference);
  return range.e.r - range.s.r + 1;
}

/** Convert XLSX/XLS workbook values to bounded, sheet-labelled CSV text. */
export function extractSpreadsheetText(input: Uint8Array): string {
  if (input.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error("Spreadsheet exceeds the 10 MB limit");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input, {
      type: "array",
      dense: true,
      cellDates: true,
      dateNF: "yyyy-mm-dd",
      sheetRows: MAX_ROWS_PER_SHEET + 1,
    });
  } catch {
    throw new Error("Spreadsheet is invalid, encrypted, or unsupported");
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("Spreadsheet contains no worksheets");
  }
  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new Error(
      `Spreadsheet contains more than ${MAX_SHEETS} worksheets`,
    );
  }

  const sections: string[] = [];
  let totalCharacters = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    if (getSheetRowCount(sheet) > MAX_ROWS_PER_SHEET) {
      throw new Error(
        `Worksheet "${sheetName}" exceeds ${MAX_ROWS_PER_SHEET} rows`,
      );
    }

    const csv = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,
      dateNF: "yyyy-mm-dd",
    });
    if (!csv.trim()) continue;

    const section = `Worksheet: ${sheetName}\n${csv.trim()}`;
    totalCharacters += section.length;
    if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
      throw new Error("Extracted spreadsheet data is too large");
    }
    sections.push(section);
  }

  if (sections.length === 0) {
    throw new Error("Spreadsheet contains no readable cell values");
  }

  return sections.join("\n\n");
}
