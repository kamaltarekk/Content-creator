import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadSourceForm } from "@/components/sources/upload-source-form";

export default async function UploadSourcePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Source Library
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Upload a source</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Original file</CardTitle>
          <CardDescription>
            The original is stored unchanged. Nothing here becomes part of the Client Brain until
            it&apos;s reviewed and approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadSourceForm clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  );
}
