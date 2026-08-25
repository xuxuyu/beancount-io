import type { LLMClient } from "../llm-client";
import { callLLM } from "../call-llm";
import type { ExtractTransactionsResult } from "../../types";
import { prepareLlmMessage } from "../prepare-llm-message";
import {
  buildTransactionSystemPrompt,
  buildTransactionTextAnalysisPrompt,
  buildTransactionImageAnalysisPrompt,
  buildTransactionFileAnalysisPrompt,
} from "./prompts";
import { splitTransactionText } from "./text-chunks";

const TEXT_PARSE_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

export async function extractTransactionsFromFile({
  llmClient,
  fileUrl,
  format,
  mediaType,
}: {
  llmClient: LLMClient;
  fileUrl: string;
  format: string;
  mediaType?: string;
}): Promise<ExtractTransactionsResult> {
  const { system, messages, textContent } = await prepareLlmMessage({
    fileUrl,
    format,
    mediaType,
    preferPdfText: true,
    preferSpreadsheetText: true,
    prompts: {
      system: buildTransactionSystemPrompt,
      text: buildTransactionTextAnalysisPrompt,
      image: buildTransactionImageAnalysisPrompt,
      file: buildTransactionFileAnalysisPrompt,
    },
  });

  if (textContent === undefined) {
    // Responses mode can pass PDFs/images directly. A statement may contain
    // hundreds of rows, so allow a larger structured response than receipts.
    return callLLM({
      llmClient,
      system,
      messages,
      maxOutputTokens: 32_768,
    });
  }

  const chunks = splitTransactionText(textContent);
  const results = await mapWithConcurrency(
    chunks,
    TEXT_PARSE_CONCURRENCY,
    async (chunk, index) =>
      callLLM({
        llmClient,
        system,
        messages: [
          {
            role: "user",
            content:
              buildTransactionTextAnalysisPrompt(format, chunk) +
              `\n\nThis is chunk ${index + 1} of ${chunks.length}. ` +
              "Extract only transactions visible in this chunk.",
          },
        ],
      }),
  );

  return {
    transactions: results.flatMap((result) => result.transactions),
    tokenUsage: results.reduce(
      (total, result) => ({
        inputTokens: total.inputTokens + result.tokenUsage.inputTokens,
        outputTokens: total.outputTokens + result.tokenUsage.outputTokens,
      }),
      { inputTokens: 0, outputTokens: 0 },
    ),
  };
}
