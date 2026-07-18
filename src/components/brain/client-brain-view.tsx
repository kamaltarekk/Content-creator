"use client";

import { useState } from "react";
import type { ClientBrainSectionKey } from "@prisma/client";

import { ALL_SECTION_KEYS, SECTION_LABELS } from "@/server/domain/brain-schema";
import type { BrainItemView } from "@/types/brain";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BrainItemCard } from "@/components/brain/brain-item-card";
import { AddBrainItemDialog } from "@/components/brain/add-brain-item-dialog";

export function ClientBrainView({
  clientId,
  items,
  canEdit,
}: {
  clientId: string;
  items: BrainItemView[];
  canEdit: boolean;
}) {
  const [activeSection, setActiveSection] = useState<ClientBrainSectionKey>("BUSINESS");

  const countsBySection = ALL_SECTION_KEYS.reduce<Record<string, number>>((acc, section) => {
    acc[section] = items.filter((item) => item.sectionKey === section).length;
    return acc;
  }, {});

  const sectionItems = items.filter((item) => item.sectionKey === activeSection);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Section rail */}
      <aside className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-2">
        {ALL_SECTION_KEYS.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              section === activeSection
                ? "bg-elevated text-foreground"
                : "text-muted-foreground hover:bg-elevated/50",
            )}
          >
            <span className="truncate">{SECTION_LABELS[section]}</span>
            {countsBySection[section] > 0 && (
              <Badge variant="muted" className="tabular-nums">
                {countsBySection[section]}
              </Badge>
            )}
          </button>
        ))}
      </aside>

      {/* Section detail */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{SECTION_LABELS[activeSection]}</h2>
          {canEdit && <AddBrainItemDialog clientId={clientId} sectionKey={activeSection} />}
        </div>

        {sectionItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm font-medium text-foreground">Nothing here yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Approve extracted items into this section from the review queue, or add one manually.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sectionItems.map((item) => (
              <BrainItemCard key={item.id} item={item} canEdit={canEdit} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
