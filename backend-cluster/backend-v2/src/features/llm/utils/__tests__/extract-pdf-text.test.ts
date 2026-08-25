import { hasUsefulPdfText } from "../extract-pdf-text";

describe("hasUsefulPdfText", () => {
  it("accepts a meaningful embedded text layer", () => {
    expect(hasUsefulPdfText("交易流水".repeat(40))).toBe(true);
  });

  it("rejects empty or nearly empty PDF output", () => {
    expect(hasUsefulPdfText(" \n\f  page 1 ")).toBe(false);
  });
});
