import { requireAction } from "@/server/auth/permissions";
import { listPendingSuggestions } from "@/server/services/strategySuggestion.service";
import type {
  StrategySuggestionView,
  SuggestionSourceReference,
  SuggestionPossibleConflict,
  SuggestionRelationship,
} from "@/types/strategy";
import { StrategySuggestionQueue } from "@/components/strategy/strategy-suggestion-queue";
import { GenerateSuggestionButton } from "@/components/strategy/generate-suggestion-button";

export default async function SuggestionReviewsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("strategy.view", { clientId });

  const suggestions = await listPendingSuggestions(clientId);
  const view: StrategySuggestionView[] = suggestions.map((s) => ({
    id: s.id,
    suggestionType: s.suggestionType,
    title: s.title,
    proposedFields: s.proposedFields as StrategySuggestionView["proposedFields"],
    sourceReferences: (s.sourceReferences as unknown as SuggestionSourceReference[]) ?? [],
    confidence: s.confidence,
    reasoningSummary: s.reasoningSummary,
    missingEvidence: s.missingEvidence,
    possibleConflicts: (s.possibleConflicts as unknown as SuggestionPossibleConflict[]) ?? [],
    suggestedRelationships: (s.suggestedRelationships as unknown as SuggestionRelationship[]) ?? [],
    status: s.status,
    isDuplicateCandidate: s.isDuplicateCandidate,
    duplicateOfEntityType: s.duplicateOfEntityType,
    duplicateOfEntityId: s.duplicateOfEntityId,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Reviews</p>
          <h1 className="text-2xl font-semibold text-foreground">AI Suggestion Review Queue</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nothing here becomes approved strategy without an explicit human decision. Every action is audited.
          </p>
        </div>
        <GenerateSuggestionButton clientId={clientId} />
      </div>
      <StrategySuggestionQueue clientId={clientId} suggestions={view} />
    </div>
  );
}
