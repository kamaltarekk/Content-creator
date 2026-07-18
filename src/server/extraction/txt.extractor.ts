import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

/**
 * Plain text: split into paragraphs on blank lines, preserving the line
 * range each paragraph spans so it stays source-traceable.
 */
export class TxtExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    const text = input.buffer.toString("utf-8").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const blocks: RawBlock[] = [];

    let paragraphLines: string[] = [];
    let paragraphStart = 1;

    const flush = (endLine: number) => {
      if (paragraphLines.length === 0) return;
      const rawText = normalizeBlockText(paragraphLines.join("\n"));
      if (rawText.length >= MIN_BLOCK_LENGTH) {
        const isHeading = paragraphLines.length === 1 && rawText.length <= 80 && !/[.!?]$/.test(rawText);
        blocks.push({
          blockType: isHeading ? "HEADING" : "PARAGRAPH",
          rawText,
          locationLabel: paragraphStart === endLine ? `Line ${paragraphStart}` : `Lines ${paragraphStart}-${endLine}`,
          location: { type: "txt_line", startLine: paragraphStart, endLine },
        });
      }
      paragraphLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];
      if (line.trim() === "") {
        flush(lineNumber - 1);
        paragraphStart = lineNumber + 1;
      } else {
        if (paragraphLines.length === 0) paragraphStart = lineNumber;
        paragraphLines.push(line);
      }
    }
    flush(lines.length);

    if (blocks.length === 0) {
      return { status: "needs_attention", reason: "Text file is empty.", blocks: [] };
    }

    return { status: "extracted", blocks };
  }
}
