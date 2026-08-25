import { describe, expect, it } from "vitest";
import { decodeUploadedText } from "../decode-text";

describe("decodeUploadedText", () => {
  it("decodes UTF-8 text", () => {
    const bytes = new TextEncoder().encode("日期,商户\n2026-08-01,测试");
    expect(decodeUploadedText(bytes)).toBe("日期,商户\n2026-08-01,测试");
  });

  it("falls back to GB18030", () => {
    const bytes = Uint8Array.from([0xd6, 0xd0, 0xb9, 0xfa]);
    expect(decodeUploadedText(bytes)).toBe("中国");
  });

  it("honours a UTF-16LE byte-order mark", () => {
    const bytes = Uint8Array.from([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    expect(decodeUploadedText(bytes)).toBe("AB");
  });
});
