import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

/** Below this average chars/page we assume a scanned/image PDF and route to NEEDS_ATTENTION instead of fabricating blocks. */
const MIN_CHARS_PER_PAGE = 24;

export class PdfExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    // pdfjs-dist legacy build is the Node-safe entry point.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(input.buffer),
      useSystemFonts: true,
    });
    let doc;
    try {
      doc = await loadingTask.promise;
    } catch {
      return { status: "needs_attention", reason: "PDF could not be parsed.", blocks: [] };
    }

    const blocks: RawBlock[] = [];
    let totalChars = 0;

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      const rawText = normalizeBlockText(pageText);
      totalChars += rawText.length;

      if (rawText.length < MIN_BLOCK_LENGTH) continue;

      blocks.push({
        blockType: "PARAGRAPH",
        rawText,
        locationLabel: `Page ${pageNumber}`,
        location: { type: "pdf_page", page: pageNumber },
      });
    }

    const numPages = doc.numPages;
    await loadingTask.destroy();

    const avgCharsPerPage = numPages > 0 ? totalChars / numPages : 0;
    if (blocks.length === 0 || avgCharsPerPage < MIN_CHARS_PER_PAGE) {
      return {
        status: "needs_attention",
        reason:
          "This PDF appears to be scanned or image-based. It requires OCR / multimodal processing, which isn't implemented yet.",
        blocks: [],
      };
    }

    return { status: "extracted", blocks };
  }
}
