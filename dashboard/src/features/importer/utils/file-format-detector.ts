/**
 * File format detection utility for the importer
 */

import type { FileFormat } from "../types";

export type { FileFormat } from "../types";

/**
 * Detect file format based on file extension and MIME type
 */
export function detectFileFormat(file: File): FileFormat {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // CSV detection
  if (extension === "csv" || mimeType === "text/csv") {
    return "csv";
  }

  // PDF detection
  if (extension === "pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  // OFX detection (Open Financial Exchange)
  if (extension === "ofx" || extension === "qfx") {
    return "ofx";
  }

  // Excel detection. Check the extension first because some browsers report
  // .xlsx files with the legacy application/vnd.ms-excel MIME type.
  if (extension === "xlsx") return "xlsx";
  if (extension === "xls") return "xls";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (mimeType === "application/vnd.ms-excel") return "xls";

  // Image detection
  if (
    ["png", "jpg", "jpeg"].includes(extension || "") ||
    mimeType.startsWith("image/")
  ) {
    return "image";
  }

  return "unknown";
}

/**
 * Get human-readable format name
 */
export function getFormatDisplayName(format: FileFormat): string {
  const names: Record<FileFormat, string> = {
    csv: "CSV",
    pdf: "PDF",
    ofx: "OFX",
    xlsx: "Excel",
    xls: "Excel",
    image: "Image",
    unknown: "Unknown",
  };
  return names[format];
}

/**
 * Check if file format is supported
 */
export function isSupportedFormat(format: FileFormat): boolean {
  return ["csv", "pdf", "ofx", "xlsx", "xls", "image"].includes(format);
}

/**
 * Get MIME type for file format
 */
export function getMimeType(fileName: string, format: FileFormat): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (format) {
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv";
    case "ofx":
      return "application/x-ofx";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "image":
      if (extension === "png") return "image/png";
      if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
      return "image/png";
    default:
      return "application/octet-stream";
  }
}
