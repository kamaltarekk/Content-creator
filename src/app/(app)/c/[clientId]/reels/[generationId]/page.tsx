import { getReelResultAction } from "@/server/actions/reelGeneration.actions";
import type { ReelValidationResult } from "@/server/domain/reel-validation";
import { ReelResultView } from "@/components/reels/reel-result-view";

export default async function ReelResultPage({ params }: { params: Promise<{ clientId: string; generationId: string }> }) {
  const { clientId, generationId } = await params;
  const { generation, latestVersion, package: pkg } = await getReelResultAction(clientId, generationId);
  const validation = latestVersion.validationJson as unknown as ReelValidationResult;

  return (
    <ReelResultView
      key={generation.currentVersionNumber}
      clientId={clientId}
      reelGenerationId={generationId}
      package={pkg}
      validation={validation}
      status={generation.status}
      versionNumber={generation.currentVersionNumber}
    />
  );
}
