import { describe, expect, it } from "vitest";

import { CsvExtractor } from "@/server/extraction/csv.extractor";
import { TxtExtractor } from "@/server/extraction/txt.extractor";
import { MarkdownExtractor } from "@/server/extraction/markdown.extractor";

function input(text: string, fileName: string, mimeType: string) {
  return { buffer: Buffer.from(text, "utf-8"), fileName, mimeType };
}

describe("CSV extraction preserves row locations", () => {
  it("emits one TABLE_ROW block per data row with the row number", async () => {
    const csv = "section,note\nPositioning,Reframer\nOffer,CEO Session";
    const result = await new CsvExtractor().extract(input(csv, "s.csv", "text/csv"));
    expect(result.status).toBe("extracted");
    if (result.status !== "extracted") return;
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].blockType).toBe("TABLE_ROW");
    expect(result.blocks[0].location).toEqual({ type: "csv_row", row: 2, headers: ["section", "note"] });
    expect(result.blocks[1].location).toMatchObject({ type: "csv_row", row: 3 });
    // Column context is preserved in the rendered text.
    expect(result.blocks[0].rawText).toContain("section: Positioning");
  });
});

describe("TXT extraction preserves line ranges", () => {
  it("splits on blank lines and records start/end line", async () => {
    const txt = "Heading\n\nFirst paragraph line one.\nline two.\n\nSecond paragraph.";
    const result = await new TxtExtractor().extract(input(txt, "s.txt", "text/plain"));
    expect(result.status).toBe("extracted");
    if (result.status !== "extracted") return;
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[0].location).toEqual({ type: "txt_line", startLine: 1, endLine: 1 });
    expect(result.blocks[1].location).toEqual({ type: "txt_line", startLine: 3, endLine: 4 });
    expect(result.blocks[2].location).toMatchObject({ type: "txt_line", startLine: 6 });
  });
});

describe("Markdown extraction preserves positions and surfaces links", () => {
  it("records line positions and emits a LINK block for a URL", async () => {
    const md = "# Positioning\n\nSee [case study](https://example.com/case).";
    const result = await new MarkdownExtractor().extract(input(md, "s.md", "text/markdown"));
    expect(result.status).toBe("extracted");
    if (result.status !== "extracted") return;
    const heading = result.blocks.find((b) => b.blockType === "HEADING");
    expect(heading?.location).toMatchObject({ type: "md_position", startLine: 1 });
    const link = result.blocks.find((b) => b.blockType === "LINK");
    expect(link?.rawText).toBe("https://example.com/case");
  });
});
