import { spawn } from "node:child_process";

const PDF_TEXT_TIMEOUT_MS = 20_000;
const PDF_TEXT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Extract the embedded text layer from a PDF with Poppler.
 *
 * The Docker image installs `pdftotext`; keeping extraction local avoids
 * sending every PDF page image through a remote Responses-compatible gateway.
 */
export function extractPdfText(input: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftotext", ["-layout", "-", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(text ?? "");
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("PDF text extraction timed out"));
    }, PDF_TEXT_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > PDF_TEXT_MAX_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("Extracted PDF text exceeds the safety limit"));
        return;
      }
      output.push(chunk);
    });
    child.stderr.resume();
    // If Poppler exits before consuming stdin, the process close/error handlers
    // below provide the useful failure; avoid an unhandled EPIPE on stdin.
    child.stdin.on("error", () => undefined);

    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code !== 0) {
        finish(new Error(`pdftotext exited with code ${code ?? "unknown"}`));
        return;
      }
      finish(undefined, Buffer.concat(output).toString("utf8"));
    });

    child.stdin.end(Buffer.from(input));
  });
}

export function hasUsefulPdfText(text: string): boolean {
  return text.replace(/\s/g, "").length >= 100;
}
