import mammoth from "mammoth";

import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

/**
 * DOCX via mammoth's raw text extraction. mammoth gives linear-order text,
 * not Word's internal XML paragraph IDs, so `index` is a stable sequential
 * pointer (documented limitation) rather than a document-model reference.
 */
export class DocxExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    let rawTextResult: string;
    try {
      const result = await mammoth.extractRawText({ buffer: input.buffer });
      rawTextResult = result.value;
    } catch {
      return { status: "needs_attention", reason: "Document could not be parsed.", blocks: [] };
    }

    const paragraphs = rawTextResult.split(/\n{1,}/);
    const blocks: RawBlock[] = [];
    let index = 0;

    for (const paragraph of paragraphs) {
      const rawText = normalizeBlockText(paragraph);
      if (rawText.length < MIN_BLOCK_LENGTH) continue;

      const isHeading = rawText.length <= 80 && !/[.!?]$/.test(rawText);
      blocks.push({
        blockType: isHeading ? "HEADING" : "PARAGRAPH",
        rawText,
        locationLabel: `Paragraph ${index + 1}`,
        location: { type: "docx_paragraph", index },
      });
      index += 1;
    }

    if (blocks.length === 0) {
      return { status: "needs_attention", reason: "Document has no extractable text.", blocks: [] };
    }

    return { status: "extracted", blocks };
  }
}
