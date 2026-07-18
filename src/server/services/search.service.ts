import "server-only";

import { prisma } from "@/server/db/prisma";
import { SECTION_LABELS, FIELD_LABELS } from "@/server/domain/brain-schema";

export type SearchResultType = "SOURCE" | "EXTRACTED_ITEM" | "BRAIN_ITEM";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  section: string | null;
  snippet: string;
  sourceName: string | null;
  status: string;
  href: string | null;
};

function snippet(text: string, query: string, length = 160): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, length);
  const start = Math.max(0, index - 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + length)}${text.length > start + length ? "…" : ""}`;
}

/**
 * Client-scoped search across sources, extracted items, and Client Brain
 * items. Uses case-insensitive substring matching (Postgres ILIKE via
 * Prisma `contains`) — a clean abstraction that a Postgres FTS or vector
 * backend can replace later without changing callers. Results never cross
 * client boundaries.
 */
export async function searchClient(clientId: string, rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const insensitive = { contains: query, mode: "insensitive" as const };

  const [sources, extracted, brainItems] = await Promise.all([
    prisma.source.findMany({
      where: {
        clientId,
        isDeleted: false,
        OR: [{ fileName: insensitive }, { title: insensitive }, { description: insensitive }],
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    }),
    prisma.extractedItem.findMany({
      where: {
        source: { clientId },
        OR: [{ normalizedValueText: insensitive }, { sourceBlock: { rawText: insensitive } }],
      },
      include: { source: true, sourceBlock: true, review: true },
      take: 15,
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientBrainItem.findMany({
      where: { clientId, status: { not: "ARCHIVED" }, valueText: insensitive },
      take: 15,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const source of sources) {
    results.push({
      type: "SOURCE",
      id: source.id,
      title: source.title || source.fileName,
      section: null,
      snippet: source.description ?? source.fileName,
      sourceName: source.fileName,
      status: source.processingStatus,
      href: `/c/${clientId}/sources/${source.id}`,
    });
  }

  for (const item of extracted) {
    const text = item.normalizedValueText ?? item.sourceBlock.rawText;
    results.push({
      type: "EXTRACTED_ITEM",
      id: item.id,
      title: item.proposedSectionKey ? SECTION_LABELS[item.proposedSectionKey] : "Unclassified item",
      section: item.proposedFieldKey ? FIELD_LABELS[item.proposedFieldKey] : null,
      snippet: snippet(text, query),
      sourceName: item.source.fileName,
      status: item.review?.status ?? "PENDING",
      href: `/c/${clientId}/reviews`,
    });
  }

  for (const item of brainItems) {
    results.push({
      type: "BRAIN_ITEM",
      id: item.id,
      title: SECTION_LABELS[item.sectionKey],
      section: FIELD_LABELS[item.fieldKey],
      snippet: snippet(item.valueText ?? "", query),
      sourceName: null,
      status: item.status,
      href: `/c/${clientId}/brain`,
    });
  }

  return results;
}
