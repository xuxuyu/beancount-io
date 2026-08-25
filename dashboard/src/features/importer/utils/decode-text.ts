const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const UTF16_LE_BOM = [0xff, 0xfe] as const;
const UTF16_BE_BOM = [0xfe, 0xff] as const;

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

/** Decode UTF-8 and common Chinese bank-export encodings in the browser. */
export function decodeUploadedText(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (startsWith(bytes, UTF8_BOM)) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (startsWith(bytes, UTF16_LE_BOM)) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (startsWith(bytes, UTF16_BE_BOM)) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}
