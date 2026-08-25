const DEFAULT_MAX_DATA_LINES = 40;
const DEFAULT_MAX_CHARS = 12_000;

const TRANSACTION_DATE =
  /(?:^|\D)(?:(?:19|20)\d{2}[-/.]?\d{1,2}[-/.]?\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:\d{2}|(?:19|20)\d{2}))(?:\D|$)/;

export type TextChunkOptions = {
  maxDataLines?: number;
  maxChars?: number;
};

/**
 * Split statement-like text on line boundaries and repeat only its leading
 * metadata/header block. This keeps each structured-output call bounded without
 * duplicating transaction rows across chunks.
 */
export function splitTransactionText(
  text: string,
  options: TextChunkOptions = {},
): string[] {
  const maxDataLines = options.maxDataLines ?? DEFAULT_MAX_DATA_LINES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [""];

  const firstDataIndex = lines.findIndex((line) => TRANSACTION_DATE.test(line));
  const header = firstDataIndex > 0 ? lines.slice(0, firstDataIndex) : [];
  const data = firstDataIndex >= 0 ? lines.slice(firstDataIndex) : lines;
  const headerText = header.join("\n");

  const chunks: string[] = [];
  let current: string[] = [];
  let currentChars = headerText.length;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push([headerText, current.join("\n")].filter(Boolean).join("\n"));
    current = [];
    currentChars = headerText.length;
  };

  for (const line of data) {
    const nextChars = currentChars + line.length + 1;
    if (
      current.length > 0 &&
      (current.length >= maxDataLines || nextChars > maxChars)
    ) {
      flush();
    }
    current.push(line);
    currentChars += line.length + 1;
  }
  flush();

  return chunks.length > 0 ? chunks : [headerText];
}
