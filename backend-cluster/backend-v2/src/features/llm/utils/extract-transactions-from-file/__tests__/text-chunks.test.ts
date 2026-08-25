import { splitTransactionText } from "../text-chunks";

describe("splitTransactionText", () => {
  it("keeps a small statement in one chunk", () => {
    const text = [
      "Date,Payee,Amount",
      "2026-08-01,Cafe,12.50",
      "2026-08-02,Market,20.00",
    ].join("\n");

    expect(splitTransactionText(text)).toEqual([text]);
  });

  it("repeats headers without duplicating transaction rows", () => {
    const text = [
      "Account statement",
      "Date,Payee,Amount",
      "20260801,Cafe,12.50",
      "20260802,Market,20.00",
      "20260803,Transit,3.00",
    ].join("\n");

    const chunks = splitTransactionText(text, {
      maxDataLines: 2,
      maxChars: 10_000,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("Account statement");
    expect(chunks[1]).toContain("Account statement");
    expect(chunks[0]).toContain("20260801,Cafe,12.50");
    expect(chunks[1]).not.toContain("20260801,Cafe,12.50");
    expect(chunks[1]).toContain("20260803,Transit,3.00");
  });

  it("also recognises month-first dates", () => {
    const chunks = splitTransactionText(
      "Date,Payee\n08/01/2026,Cafe\n08/02/2026,Market",
      { maxDataLines: 1 },
    );
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.startsWith("Date,Payee"))).toBe(true);
  });
});
