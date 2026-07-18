import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Node } from "unist";
import type { BlockType } from "@prisma/client";

import type { Extractor, ExtractorInput, ExtractionResult, RawBlock } from "@/server/extraction/types";
import { MIN_BLOCK_LENGTH, normalizeBlockText } from "@/server/extraction/types";

type PositionedNode = Node & {
  type: string;
  position?: { start: { line: number }; end: { line: number } };
  url?: string;
};

const NODE_TYPE_TO_BLOCK: Record<string, BlockType> = {
  heading: "HEADING",
  paragraph: "PARAGRAPH",
  listItem: "LIST_ITEM",
  blockquote: "QUOTE",
  tableRow: "TABLE_ROW",
  code: "NOTE",
};

export class MarkdownExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractionResult> {
    const text = input.buffer.toString("utf-8");
    const tree = unified().use(remarkParse).use(remarkGfm).parse(text);

    const blocks: RawBlock[] = [];

    const pushBlock = (node: PositionedNode, blockType: BlockType, rawTextOverride?: string) => {
      const rawText = normalizeBlockText(rawTextOverride ?? mdastToString(node));
      if (rawText.length < MIN_BLOCK_LENGTH) return;
      const startLine = node.position?.start.line ?? 0;
      const endLine = node.position?.end.line ?? startLine;
      blocks.push({
        blockType,
        rawText,
        locationLabel: startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`,
        location: { type: "md_position", startLine, endLine },
      });
    };

    visit(tree, (node: PositionedNode) => {
      const blockType = NODE_TYPE_TO_BLOCK[node.type];
      if (!blockType) return;

      // Don't descend into list items' or blockquotes' child paragraphs separately —
      // capture the container once and skip its subtree.
      if (node.type === "listItem" || node.type === "blockquote" || node.type === "tableRow") {
        pushBlock(node, blockType);
        return SKIP;
      }

      if (node.type === "paragraph") {
        pushBlock(node, blockType);
        // Also surface any links inside the paragraph as EXTERNAL_SOURCE candidates.
        visit(node, "link", (linkNode: PositionedNode) => {
          if (linkNode.url) {
            const startLine = linkNode.position?.start.line ?? 0;
            const endLine = linkNode.position?.end.line ?? startLine;
            blocks.push({
              blockType: "LINK",
              rawText: linkNode.url,
              locationLabel: `Line ${startLine}`,
              location: { type: "md_position", startLine, endLine },
            });
          }
        });
        return SKIP;
      }

      pushBlock(node, blockType);
    });

    if (blocks.length === 0) {
      return { status: "needs_attention", reason: "Markdown file has no extractable content.", blocks: [] };
    }

    return { status: "extracted", blocks };
  }
}
