"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Download, FileWarning } from "lucide-react";

import type { ConfidentialityLevel, SourceCategory, SourceFileType, SourceProcessingStatus } from "@prisma/client";
import { SOURCE_CATEGORY_OPTIONS, CONFIDENTIALITY_OPTIONS } from "@/server/domain/source-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type SourceRow = {
  id: string;
  fileName: string;
  fileType: SourceFileType;
  sourceCategory: SourceCategory;
  createdAt: Date;
  uploadedByName: string;
  processingStatus: SourceProcessingStatus;
  extractedItemCount: number;
  confidentiality: ConfidentialityLevel;
  tags: { id: string; label: string }[];
  currentVersionNumber: number;
  requiresMultimodal: boolean;
};

const PROCESSING_BADGE: Record<SourceProcessingStatus, "muted" | "warning" | "success" | "destructive"> = {
  UPLOADED: "muted",
  QUEUED: "muted",
  PROCESSING: "muted",
  NEEDS_ATTENTION: "warning",
  READY_FOR_REVIEW: "success",
  COMPLETED: "success",
  FAILED: "destructive",
};

function extractionStatusLabel(status: SourceProcessingStatus, extractedItemCount: number) {
  if (status === "FAILED") return "Failed";
  if (status === "NEEDS_ATTENTION") return "Needs attention";
  if (["UPLOADED", "QUEUED", "PROCESSING"].includes(status)) return "Pending";
  return extractedItemCount > 0 ? "Extracted" : "No items found";
}

function categoryLabel(value: SourceCategory) {
  return SOURCE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function confidentialityLabel(value: ConfidentialityLevel) {
  return CONFIDENTIALITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function SourceLibraryTable({ clientId, sources }: { clientId: string; sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">No sources yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload a strategic framework, market research, or any other document to start building
          this client&apos;s Client Brain.
        </p>
        <Button asChild className="mt-2">
          <Link href={`/c/${clientId}/sources/upload`}>Upload a source</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Processing</TableHead>
            <TableHead>Extraction</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Confidentiality</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Version</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <TableCell>
                <Link href={`/c/${clientId}/sources/${source.id}`} className="flex items-center gap-1.5">
                  {source.requiresMultimodal && (
                    <FileWarning className="size-3.5 shrink-0 text-warning" />
                  )}
                  <span className="max-w-56 truncate font-medium text-foreground hover:underline">
                    {source.fileName}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    {source.fileType}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{categoryLabel(source.sourceCategory)}</TableCell>
              <TableCell className="text-muted-foreground">{format(source.createdAt, "MMM d, yyyy")}</TableCell>
              <TableCell className="text-muted-foreground">{source.uploadedByName}</TableCell>
              <TableCell>
                <Badge variant={PROCESSING_BADGE[source.processingStatus]}>{source.processingStatus}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {extractionStatusLabel(source.processingStatus, source.extractedItemCount)}
              </TableCell>
              <TableCell>{source.extractedItemCount}</TableCell>
              <TableCell>
                <Badge variant={source.confidentiality === "RESTRICTED" ? "warning" : "outline"}>
                  {confidentialityLabel(source.confidentiality)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {source.tags.map((tag) => (
                    <Badge key={tag.id} variant="muted">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">v{source.currentVersionNumber}</TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="icon" aria-label={`Download ${source.fileName}`}>
                  <a href={`/api/sources/${source.id}/download`}>
                    <Download className="size-4" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
