import { type ImagePart, type FilePart, type ModelMessage } from "ai";
import { classifyFile, resolveMediaType } from "./media-type-utils";
import { BadUserInputError, ServiceUnavailableError } from "@/shared/errors";
import { logger } from "@/shared/logger";
import { decodeUploadedText } from "./decode-text";
import { extractPdfText, hasUsefulPdfText } from "./extract-pdf-text";
import { extractSpreadsheetText } from "./extract-spreadsheet-text";

const prepareMessageLogger = logger.child({ module: "prepare-llm-message" });

type PromptBuilders = {
  system: (format: string) => string;
  text: (format: string, content: string) => string;
  image: () => string;
  file: (format: string) => string;
};

export async function prepareLlmMessage({
  fileUrl,
  format,
  mediaType,
  prompts,
  preferPdfText = false,
  preferSpreadsheetText = false,
}: {
  fileUrl: string;
  format: string;
  mediaType?: string;
  prompts: PromptBuilders;
  preferPdfText?: boolean;
  preferSpreadsheetText?: boolean;
}): Promise<{
  system: string;
  messages: ModelMessage[];
  textContent?: string;
}> {
  const system = prompts.system(format);
  const category = classifyFile(format, mediaType);

  const downloadBytes = async (): Promise<Uint8Array> => {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new ServiceUnavailableError(
        `File download (${response.status} ${response.statusText})`.trim(),
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  };

  const buildTextResult = (textContent: string) => ({
    system,
    textContent,
    messages: [
      {
        role: "user" as const,
        content: prompts.text(format, textContent),
      },
    ],
  });

  if (category === "text") {
    return buildTextResult(decodeUploadedText(await downloadBytes()));
  }

  const resolvedMediaType = resolveMediaType(format, mediaType);
  if (
    preferSpreadsheetText &&
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ].includes(resolvedMediaType)
  ) {
    let spreadsheetText: string;
    try {
      spreadsheetText = extractSpreadsheetText(await downloadBytes());
    } catch (error) {
      throw new BadUserInputError(
        error instanceof Error
          ? error.message
          : "Spreadsheet could not be read",
      );
    }
    prepareMessageLogger.info("Using locally extracted spreadsheet text", {
      characters: spreadsheetText.length,
    });
    return buildTextResult(spreadsheetText);
  }

  if (preferPdfText && resolvedMediaType === "application/pdf") {
    const pdfBytes = await downloadBytes();
    try {
      const textContent = await extractPdfText(pdfBytes);
      if (hasUsefulPdfText(textContent)) {
        prepareMessageLogger.info("Using locally extracted PDF text", {
          characters: textContent.length,
        });
        return buildTextResult(textContent.replace(/\f/g, "\n"));
      }
      prepareMessageLogger.info(
        "PDF has no useful embedded text; using file input fallback",
      );
    } catch (error) {
      prepareMessageLogger.warn(
        "Local PDF text extraction failed; using file input fallback",
        { error: error instanceof Error ? error.name : "UnknownError" },
      );
    }
  }

  if (category === "image") {
    const imagePart: ImagePart = { type: "image", image: fileUrl };
    return {
      system,
      messages: [
        {
          role: "user",
          content: [imagePart, { type: "text", text: prompts.image() }],
        },
      ],
    };
  }

  const filePart: FilePart = {
    type: "file",
    mediaType: resolvedMediaType,
    data: fileUrl,
  };
  return {
    system,
    messages: [
      {
        role: "user",
        content: [filePart, { type: "text", text: prompts.file(format) }],
      },
    ],
  };
}
