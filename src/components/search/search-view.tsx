"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import type { SearchResult } from "@/server/services/search.service";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const nativeSelect =
  "flex h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  SOURCE: "Source",
  EXTRACTED_ITEM: "Extracted item",
  BRAIN_ITEM: "Client Brain",
};

export function SearchView({ clients }: { clients: { id: string; displayName: string }[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["search", clientId, query],
    enabled: query.trim().length >= 2 && Boolean(clientId),
    queryFn: async () => {
      const params = new URLSearchParams({ clientId, q: query });
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return (await res.json()) as { results: SearchResult[] };
    },
  });

  const results = data?.results ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <select
          className={nativeSelect}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Client to search within"
        >
          {clients.length === 0 && <option value="">No clients</option>}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.displayName}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search sources, extracted items, and the Client Brain…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {query.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
      ) : isFetching && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches in this client.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((result) => {
            const content = (
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-elevated/40">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[result.type]}</Badge>
                  <span className="text-sm font-medium text-foreground">{result.title}</span>
                  {result.section && <span className="text-xs text-muted-foreground">· {result.section}</span>}
                  <Badge variant="muted" className="ml-auto">
                    {result.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{result.snippet}</p>
                {result.sourceName && (
                  <p className="text-xs text-muted-foreground/70">Source: {result.sourceName}</p>
                )}
              </div>
            );
            return result.href ? (
              <Link key={`${result.type}-${result.id}`} href={result.href}>
                {content}
              </Link>
            ) : (
              <div key={`${result.type}-${result.id}`}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
