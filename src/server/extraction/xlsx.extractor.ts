import ExcelJS from "exceljs";

import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
    return "";
  }
  return String(value);
}

export class XlsxExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs types accept a Node Buffer here despite the ArrayBuffer signature.
      await workbook.xlsx.load(input.buffer as unknown as ArrayBuffer);
    } catch {
      return { status: "needs_attention", reason: "Spreadsheet could not be parsed.", blocks: [] };
    }

    const blocks: RawBlock[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      const headers: string[] = [];

      worksheet.eachRow((row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cells = values.map((value) => cellToString(value as ExcelJS.CellValue).trim());

        if (rowNumber === 1) {
          headers.push(...cells);
          return;
        }

        const rendered = cells
          .map((value, columnIndex) => {
            if (!value) return null;
            const header = headers[columnIndex];
            return header ? `${header}: ${value}` : value;
          })
          .filter(Boolean)
          .join("\n");

        const rawText = normalizeBlockText(rendered);
        if (rawText.length < MIN_BLOCK_LENGTH) return;

        blocks.push({
          blockType: "TABLE_ROW",
          rawText,
          locationLabel: `${sheetName}!Row ${rowNumber}`,
          location: { type: "xlsx_row", sheet: sheetName, row: rowNumber },
        });
      });
    });

    if (blocks.length === 0) {
      return { status: "needs_attention", reason: "Spreadsheet has no data rows.", blocks: [] };
    }

    return { status: "extracted", blocks };
  }
}
