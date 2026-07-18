import Papa from "papaparse";

import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

export class CsvExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    const text = input.buffer.toString("utf-8");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return { status: "needs_attention", reason: "CSV could not be parsed.", blocks: [] };
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      return { status: "needs_attention", reason: "CSV has no rows.", blocks: [] };
    }

    // First row is treated as the header; each data row becomes one TABLE_ROW block.
    const headers = rows[0].map((cell) => String(cell ?? "").trim());
    const blocks: RawBlock[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Render the row as "header: value" pairs so the classifier sees column context.
      const rendered = row
        .map((cell, columnIndex) => {
          const value = String(cell ?? "").trim();
          if (!value) return null;
          const header = headers[columnIndex];
          return header ? `${header}: ${value}` : value;
        })
        .filter(Boolean)
        .join("\n");

      const rawText = normalizeBlockText(rendered);
      if (rawText.length < MIN_BLOCK_LENGTH) continue;

      const rowNumber = i + 1; // 1-based including header row, matches spreadsheet intuition
      blocks.push({
        blockType: "TABLE_ROW",
        rawText,
        locationLabel: `Row ${rowNumber}`,
        location: { type: "csv_row", row: rowNumber, headers },
      });
    }

    if (blocks.length === 0) {
      return { status: "needs_attention", reason: "CSV has a header but no data rows.", blocks: [] };
    }

    return { status: "extracted", blocks };
  }
}
