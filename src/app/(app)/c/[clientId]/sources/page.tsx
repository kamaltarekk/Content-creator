import Link from "next/link";

import { listSourcesForClient } from "@/server/services/source.service";
import { Button } from "@/components/ui/button";
import { SourceLibraryTable } from "@/components/sources/source-library-table";

export default async function SourceLibraryPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const sources = await listSourcesForClient(clientId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Source Library
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Sources</h1>
        </div>
        <Button asChild>
          <Link href={`/c/${clientId}/sources/upload`}>Upload source</Link>
        </Button>
      </div>
      <SourceLibraryTable clientId={clientId} sources={sources} />
    </div>
  );
}
