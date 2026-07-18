import { listPendingReviews } from "@/server/services/import.service";
import { SECTION_LABELS } from "@/server/domain/brain-schema";
import type { ReviewQueueItem } from "@/types/review";
import { ReviewQueue } from "@/components/review/review-queue";

export default async function ImportReviewsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const reviews = await listPendingReviews(clientId);

  const items: ReviewQueueItem[] = reviews.map((review) => {
    const extracted = review.extractedItem;
    return {
      reviewId: review.id,
      extractedItemId: extracted.id,
      informationType: extracted.informationType,
      proposedSectionKey: extracted.proposedSectionKey,
      proposedFieldKey: extracted.proposedFieldKey,
      normalizedValueText: extracted.normalizedValueText,
      confidence: extracted.confidence,
      detectedLanguage: extracted.detectedLanguage,
      reasoningSummary: extracted.reasoningSummary,
      isConflictCandidate: extracted.isConflictCandidate,
      validationStatus: extracted.validationStatus,
      validationNotes: extracted.validationNotes,
      suggestedTags: extracted.suggestedTags,
      originalText: extracted.sourceBlock.rawText,
      blockType: extracted.sourceBlock.blockType,
      sourceLocationLabel: extracted.sourceBlock.locationLabel,
      sourceId: extracted.sourceId,
      sourceFileName: extracted.source.fileName,
      detectedSection: extracted.proposedSectionKey
        ? SECTION_LABELS[extracted.proposedSectionKey]
        : "Unclassified",
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Import Reviews
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Review queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Nothing here is trusted yet. Approve, edit, remap, reject, or keep each extracted item as
          raw material. Approved items become part of the Client Brain with full source traceability.
        </p>
      </div>
      <ReviewQueue clientId={clientId} items={items} />
    </div>
  );
}
