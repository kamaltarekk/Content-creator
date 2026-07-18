import type { BlockType } from "@prisma/client";

/**
 * A single segmented block produced by an extractor, before it's persisted
 * as a SourceBlock. `locationJson` preserves the exact origin (CSV row,
 * XLSX sheet+row, PDF page, DOCX paragraph index, text line range) so every
 * downstream Client Brain item stays source-traceable. `locationLabel` is a
 * short human-readable form of the same ("Row 37", "Sheet1!A5", "Page 3").
 */
export type SourceLocation =
  | { type: "csv_row"; row: number; headers: string[] }
  | { type: "xlsx_row"; sheet: string; row: number }
  | { type: "txt_line"; startLine: number; endLine: number }
  | { type: "md_position"; startLine: number; endLine: number }
  | { type: "docx_paragraph"; index: number }
  | { type: "pdf_page"; page: number };

export type RawBlock = {
  blockType: BlockType;
  rawText: string;
  locationLabel: string;
  location: SourceLocation;
};

export type ExtractionResult =
  | { status: "extracted"; blocks: RawBlock[] }
  | { status: "needs_attention"; reason: string; blocks: RawBlock[] }
  | { status: "unsupported"; reason: string };

export type ExtractorInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export interface Extractor {
  extract(input: ExtractorInput): Promise<ExtractionResult>;
}

/** Collapses runs of whitespace and trims — keeps block text tidy without losing content. */
export function normalizeBlockText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Blocks below this length are dropped as noise (empty cells, stray punctuation). */
export const MIN_BLOCK_LENGTH = 2;
