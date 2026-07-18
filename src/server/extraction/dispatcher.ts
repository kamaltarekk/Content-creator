import type { SourceFileType } from "@prisma/client";

import type { Extractor, ExtractionResult, ExtractorInput } from "@/server/extraction/types";
import { CsvExtractor } from "@/server/extraction/csv.extractor";
import { XlsxExtractor } from "@/server/extraction/xlsx.extractor";
import { TxtExtractor } from "@/server/extraction/txt.extractor";
import { MarkdownExtractor } from "@/server/extraction/markdown.extractor";
import { DocxExtractor } from "@/server/extraction/docx.extractor";
import { PdfExtractor } from "@/server/extraction/pdf.extractor";
import { processingAdapter } from "@/server/providers/processing/stub.processing.adapter";

const EXTRACTORS: Partial<Record<SourceFileType, Extractor>> = {
  CSV: new CsvExtractor(),
  XLSX: new XlsxExtractor(),
  TXT: new TxtExtractor(),
  MARKDOWN: new MarkdownExtractor(),
  DOCX: new DocxExtractor(),
  PDF: new PdfExtractor(),
};

/**
 * Routes a source to the right extractor by file type. Multimodal types
 * (image/audio/video) go to the processing adapter, which currently reports
 * "unsupported" without fabricating any content.
 */
export async function extractSource(
  fileType: SourceFileType,
  input: ExtractorInput & { storageKey: string },
): Promise<ExtractionResult> {
  const extractor = EXTRACTORS[fileType];
  if (extractor) {
    return extractor.extract(input);
  }

  if (processingAdapter.supports(fileType, input.mimeType)) {
    const result = await processingAdapter.process({
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileType,
    });
    if (result.status === "unsupported") {
      return { status: "unsupported", reason: result.reason };
    }
    return { status: "extracted", blocks: result.blocks };
  }

  return { status: "unsupported", reason: `No extractor available for ${fileType}.` };
}
