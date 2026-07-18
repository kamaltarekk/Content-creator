import type { SourceFileType } from "@prisma/client";

import type { ProcessingAdapter } from "@/server/providers/processing/processing.adapter";
import { MULTIMODAL_FILE_TYPES } from "@/server/domain/source-schema";

/**
 * Placeholder multimodal adapter. Accepts the file types that need OCR/ASR
 * but always returns "unsupported" — it must never invent blocks. Swapping
 * in a real implementation only requires replacing this class.
 */
export class StubProcessingAdapter implements ProcessingAdapter {
  supports(fileType: SourceFileType): boolean {
    return MULTIMODAL_FILE_TYPES.includes(fileType);
  }

  async process(): Promise<{ status: "unsupported"; reason: string }> {
    return {
      status: "unsupported",
      reason: "Requires multimodal processing (OCR / transcription), which isn't implemented yet.",
    };
  }
}

export const processingAdapter: ProcessingAdapter = new StubProcessingAdapter();
