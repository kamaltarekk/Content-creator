import "server-only";

import { createHash } from "node:crypto";

import type { ConfidentialityLevel, SourceCategory } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { storageProvider, buildSourceStorageKey } from "@/server/providers/storage/local.storage.provider";
import { securityScanner } from "@/server/providers/security/security-scanner";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MULTIMODAL_FILE_TYPES,
  detectSourceFileType,
  parseTagList,
  sanitizeFileName,
} from "@/server/domain/source-schema";

export class UploadValidationError extends Error {}

/**
 * Recomputes a source's status after review activity. Once every ImportReview
 * tied to the source's extracted items has left PENDING, the source is
 * COMPLETED; while any remain and the source was already processed, it stays
 * READY_FOR_REVIEW. Never downgrades a FAILED/NEEDS_ATTENTION source.
 */
export async function recalculateSourceCompletion(sourceId: string): Promise<void> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { processingStatus: true },
  });
  if (!source) return;
  if (source.processingStatus !== "READY_FOR_REVIEW" && source.processingStatus !== "COMPLETED") {
    return;
  }

  const pending = await prisma.importReview.count({
    where: { extractedItem: { sourceId }, status: "PENDING" },
  });
  const total = await prisma.importReview.count({ where: { extractedItem: { sourceId } } });

  const nextStatus = total > 0 && pending === 0 ? "COMPLETED" : "READY_FOR_REVIEW";
  if (nextStatus !== source.processingStatus) {
    await prisma.source.update({ where: { id: sourceId }, data: { processingStatus: nextStatus } });
  }
}

async function resolveUploaderNames(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

export async function listSourcesForClient(clientId: string) {
  const sources = await prisma.source.findMany({
    where: { clientId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      tags: true,
      _count: { select: { extractedItems: true } },
    },
  });

  const uploaderNames = await resolveUploaderNames(sources.map((source) => source.uploadedById));

  return sources.map((source) => ({
    ...source,
    uploadedByName: uploaderNames.get(source.uploadedById) ?? "Unknown",
    extractedItemCount: source._count.extractedItems,
  }));
}

export async function getSourceById(sourceId: string) {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: {
      tags: true,
      jobs: { orderBy: { createdAt: "desc" } },
      _count: { select: { extractedItems: true, blocks: true } },
    },
  });
  if (!source) return null;

  const uploaderNames = await resolveUploaderNames([source.uploadedById]);
  return { ...source, uploadedByName: uploaderNames.get(source.uploadedById) ?? "Unknown" };
}

export type UploadSourceInput = {
  clientId: string;
  uploadedById: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  sourceCategory: SourceCategory;
  title?: string;
  description?: string;
  confidentiality: ConfidentialityLevel;
  tags: string[];
  processingInstructions?: string;
};

export async function uploadSource(input: UploadSourceInput) {
  if (input.buffer.byteLength === 0) {
    throw new UploadValidationError("The uploaded file is empty.");
  }
  if (input.buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError(
      `File is too large (max ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB).`,
    );
  }

  const fileType = detectSourceFileType(input.fileName, input.mimeType);
  if (!fileType) {
    throw new UploadValidationError(
      "Unsupported file type. Supported: CSV, XLSX, PDF, DOCX, TXT, Markdown, images, audio, video.",
    );
  }

  const scanResult = await securityScanner.scan({
    buffer: input.buffer,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  if (!scanResult.safe) {
    throw new UploadValidationError(`Upload rejected by security scan: ${scanResult.reason}`);
  }

  const safeFileName = sanitizeFileName(input.fileName);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  const duplicate = await prisma.source.findFirst({
    where: { clientId: input.clientId, checksumSha256: checksum, isDeleted: false },
  });

  const source = await prisma.$transaction(async (tx) => {
    const created = await tx.source.create({
      data: {
        clientId: input.clientId,
        fileName: safeFileName,
        originalFileName: input.fileName,
        fileType,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.byteLength,
        checksumSha256: checksum,
        storageKey: "", // filled in below once we know the sourceId
        sourceCategory: input.sourceCategory,
        title: input.title || null,
        description: input.description || null,
        confidentiality: input.confidentiality,
        processingInstructions: input.processingInstructions || null,
        requiresMultimodal: MULTIMODAL_FILE_TYPES.includes(fileType),
        uploadedById: input.uploadedById,
        processingStatus: "UPLOADED",
        tags: input.tags.length
          ? {
              connectOrCreate: input.tags.map((label) => ({
                where: { clientId_label: { clientId: input.clientId, label } },
                create: { clientId: input.clientId, label },
              })),
            }
          : undefined,
      },
    });

    const storageKey = buildSourceStorageKey(input.clientId, created.id, 1, safeFileName);
    await tx.source.update({ where: { id: created.id }, data: { storageKey } });
    await tx.sourceVersion.create({
      data: {
        sourceId: created.id,
        versionNumber: 1,
        storageKey,
        checksumSha256: checksum,
        sizeBytes: input.buffer.byteLength,
        uploadedById: input.uploadedById,
      },
    });

    const job = await tx.sourceProcessingJob.create({
      data: { sourceId: created.id, jobType: "PROCESS_SOURCE", status: "PENDING" },
    });
    await tx.source.update({ where: { id: created.id }, data: { processingStatus: "QUEUED" } });

    return { ...created, storageKey, jobId: job.id };
  });

  await storageProvider.save(source.storageKey, input.buffer);

  await logAudit({
    organizationId: input.organizationId,
    clientId: input.clientId,
    actorUserId: input.uploadedById,
    action: "CREATE",
    entityType: "Source",
    entityId: source.id,
    metadata: { fileName: safeFileName, fileType, duplicateOfSourceId: duplicate?.id ?? null },
  });

  return { source, isDuplicate: Boolean(duplicate), duplicateOfSourceId: duplicate?.id ?? null };
}

/**
 * Soft-deletes a source: flips isDeleted so it drops out of the library and
 * search, but never removes the stored original file or the row (spec section
 * 18 — originals are never hard-deleted by default). Records an audit entry.
 */
export async function softDeleteSource(params: { sourceId: string; organizationId: string; userId: string }) {
  const source = await prisma.source.update({
    where: { id: params.sourceId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: source.clientId,
    actorUserId: params.userId,
    action: "SOFT_DELETE",
    entityType: "Source",
    entityId: source.id,
    metadata: { fileName: source.fileName },
  });

  return source;
}

export { parseTagList };
