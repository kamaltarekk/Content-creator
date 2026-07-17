import { z } from "zod";
import type { SourceFileType } from "@prisma/client";

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const SOURCE_CATEGORY_OPTIONS = [
  { value: "STRATEGIC_FRAMEWORK", label: "Strategic Framework" },
  { value: "MARKET_RESEARCH", label: "Market Research" },
  { value: "CUSTOMER_FEEDBACK", label: "Customer Feedback" },
  { value: "SALES_DATA", label: "Sales Data" },
  { value: "BRAND_GUIDELINES", label: "Brand Guidelines" },
  { value: "PERFORMANCE_REPORT", label: "Performance Report" },
  { value: "MEETING_NOTES", label: "Meeting Notes" },
  { value: "COMPETITOR_INTEL", label: "Competitor Intel" },
  { value: "OTHER", label: "Other" },
] as const;

export const CONFIDENTIALITY_OPTIONS = [
  { value: "INTERNAL", label: "Internal" },
  { value: "CLIENT_CONFIDENTIAL", label: "Client Confidential" },
  { value: "RESTRICTED", label: "Restricted" },
] as const;

/** File types the extraction pipeline fully implements (spec section D). */
export const FULLY_PARSED_FILE_TYPES: SourceFileType[] = ["CSV", "XLSX", "TXT", "MARKDOWN", "DOCX", "PDF"];
/** Accepted but requiring a multimodal processing adapter that doesn't exist yet. */
export const MULTIMODAL_FILE_TYPES: SourceFileType[] = ["IMAGE", "AUDIO", "VIDEO"];

const EXTENSION_MAP: Record<string, SourceFileType> = {
  csv: "CSV",
  xlsx: "XLSX",
  xls: "XLSX",
  pdf: "PDF",
  docx: "DOCX",
  doc: "DOCX",
  txt: "TXT",
  md: "MARKDOWN",
  markdown: "MARKDOWN",
};

const MIME_PREFIX_MAP: Array<[prefix: string, type: SourceFileType]> = [
  ["image/", "IMAGE"],
  ["audio/", "AUDIO"],
  ["video/", "VIDEO"],
];

export function detectSourceFileType(fileName: string, mimeType: string): SourceFileType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension && EXTENSION_MAP[extension]) return EXTENSION_MAP[extension];

  for (const [prefix, type] of MIME_PREFIX_MAP) {
    if (mimeType.startsWith(prefix)) return type;
  }

  if (mimeType === "text/csv") return "CSV";
  if (mimeType === "text/plain") return "TXT";
  if (mimeType === "text/markdown") return "MARKDOWN";
  if (mimeType === "application/pdf") return "PDF";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "XLSX";
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "DOCX";
  }

  return null;
}

/** Strips path separators and control/unsafe characters; preserves the extension. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "");
  const cleaned = base
    .normalize("NFKD")
    .replace(/\p{Cc}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "");
  return cleaned.slice(0, 200) || "upload";
}

export const uploadMetadataSchema = z.object({
  sourceCategory: z.enum([
    "STRATEGIC_FRAMEWORK",
    "MARKET_RESEARCH",
    "CUSTOMER_FEEDBACK",
    "SALES_DATA",
    "BRAND_GUIDELINES",
    "PERFORMANCE_REPORT",
    "MEETING_NOTES",
    "COMPETITOR_INTEL",
    "OTHER",
  ]),
  title: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  confidentiality: z.enum(["INTERNAL", "CLIENT_CONFIDENTIAL", "RESTRICTED"]),
  tags: z.string().max(500).optional().or(z.literal("")),
  processingInstructions: z.string().max(1000).optional().or(z.literal("")),
});

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;

export function parseTagList(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}
