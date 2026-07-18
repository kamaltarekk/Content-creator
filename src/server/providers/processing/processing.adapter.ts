import type { SourceFileType } from "@prisma/client";

import type { RawBlock } from "@/server/extraction/types";

/**
 * Boundary for multimodal (image / audio / video / scanned-PDF) processing.
 * The MVP ships only a stub that reports "unsupported" — a real OCR/ASR
 * adapter can be dropped in later behind this same interface. The stub
 * NEVER fabricates extraction results (spec section D).
 */
export interface ProcessingAdapter {
  supports(fileType: SourceFileType, mimeType: string): boolean;
  process(input: { storageKey: string; mimeType: string; fileType: SourceFileType }): Promise<
    { status: "unsupported"; reason: string } | { status: "extracted"; blocks: RawBlock[] }
  >;
}
