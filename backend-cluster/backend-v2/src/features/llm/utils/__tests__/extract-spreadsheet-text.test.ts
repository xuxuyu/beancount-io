import * as XLSX from "xlsx";
import { extractSpreadsheetText } from "../extract-spreadsheet-text";

function createWorkbook(bookType: "xlsx" | "xls"): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Date", "Payee", "Amount"],
      [new Date("2026-08-01T00:00:00Z"), "测试商户", -12.5],
    ]),
    "Transactions",
  );
  return XLSX.write(workbook, { type: "array", bookType });
}

describe("extractSpreadsheetText", () => {
  it.each(["xlsx", "xls"] as const)("extracts %s cell values", (bookType) => {
    const text = extractSpreadsheetText(createWorkbook(bookType));
    expect(text).toContain("Worksheet: Transactions");
    expect(text).toContain("Date,Payee,Amount");
    expect(text).toContain("测试商户");
    expect(text).toContain("-12.5");
  });

  it("rejects an empty workbook", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
    const bytes: Uint8Array = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });
    expect(() => extractSpreadsheetText(bytes)).toThrow(
      "no readable cell values",
    );
  });
});
