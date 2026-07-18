import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Download } from "lucide-react";

import { getSourceById } from "@/server/services/source.service";
import { SOURCE_CATEGORY_OPTIONS, CONFIDENTIALITY_OPTIONS } from "@/server/domain/source-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SourceStatusPoller } from "@/components/sources/source-status-poller";
import { DeleteSourceButton } from "@/components/sources/delete-source-button";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; sourceId: string }>;
}) {
  const { clientId, sourceId } = await params;
  const source = await getSourceById(sourceId);
  if (!source) notFound();

  const category = SOURCE_CATEGORY_OPTIONS.find((o) => o.value === source.sourceCategory)?.label;
  const confidentiality = CONFIDENTIALITY_OPTIONS.find((o) => o.value === source.confidentiality)?.label;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Processing report
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{source.fileName}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/sources/${source.id}/download`}>
              <Download className="size-4" />
              Download original
            </a>
          </Button>
          <DeleteSourceButton sourceId={source.id} clientId={clientId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Processing status</p>
            <div className="mt-1">
              <SourceStatusPoller sourceId={source.id} initialStatus={source.processingStatus} />
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Blocks</p>
            <p className="mt-1 font-medium text-foreground">{source._count.blocks}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Extracted items</p>
            <p className="mt-1 font-medium text-foreground">{source._count.extractedItems}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="mt-1 font-medium text-foreground">v{source.currentVersionNumber}</p>
          </CardContent>
        </Card>
      </div>

      {source.requiresMultimodal && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="text-sm text-warning">
            This file type requires multimodal processing, which isn&apos;t implemented yet. The
            original is stored and its metadata is tracked, but no content has been extracted.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Original file name</dt>
              <dd className="text-foreground">{source.originalFileName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">File type</dt>
              <dd className="text-foreground">{source.fileType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-foreground">{category}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confidentiality</dt>
              <dd className="text-foreground">
                <Badge variant={source.confidentiality === "RESTRICTED" ? "warning" : "outline"}>
                  {confidentiality}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Uploaded by</dt>
              <dd className="text-foreground">{source.uploadedByName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Uploaded at</dt>
              <dd className="text-foreground">{format(source.createdAt, "MMM d, yyyy p")}</dd>
            </div>
            {source.title && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-muted-foreground">Title</dt>
                <dd className="text-foreground">{source.title}</dd>
              </div>
            )}
            {source.description && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-foreground">{source.description}</dd>
              </div>
            )}
            {source.processingInstructions && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-muted-foreground">Processing instructions</dt>
                <dd className="text-foreground">{source.processingInstructions}</dd>
              </div>
            )}
          </dl>
          {source.tags.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-1.5">
                {source.tags.map((tag) => (
                  <Badge key={tag.id} variant="muted">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {source.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {source.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant={job.status === "FAILED" ? "destructive" : "outline"}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.attempts}/{job.maxAttempts}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.startedAt ? format(job.startedAt, "MMM d, p") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.finishedAt ? format(job.finishedAt, "MMM d, p") : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-destructive">
                      {job.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
