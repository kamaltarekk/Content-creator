"use server";

import { redirect } from "next/navigation";

import { requireAction } from "@/server/auth/permissions";
import { uploadMetadataSchema, parseTagList } from "@/server/domain/source-schema";
import { uploadSource, UploadValidationError } from "@/server/services/source.service";
import { ensureJobRunnerStarted } from "@/server/jobs/local.job.runner";

export type UploadSourceState = {
  error: string | null;
};

export async function uploadSourceAction(
  clientId: string,
  _prevState: UploadSourceState,
  formData: FormData,
): Promise<UploadSourceState> {
  const session = await requireAction("source.upload", { clientId });
  if (!session.user.orgId) {
    return { error: "Your account is not attached to an organization." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }

  const parsed = uploadMetadataSchema.safeParse({
    sourceCategory: formData.get("sourceCategory"),
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    confidentiality: formData.get("confidentiality"),
    tags: formData.get("tags") ?? "",
    processingInstructions: formData.get("processingInstructions") ?? "",
  });

  if (!parsed.success) {
    return { error: "Please fix the errors in the upload form." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let sourceId: string;
  try {
    const result = await uploadSource({
      clientId,
      uploadedById: session.user.id,
      organizationId: session.user.orgId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      sourceCategory: parsed.data.sourceCategory,
      title: parsed.data.title,
      description: parsed.data.description,
      confidentiality: parsed.data.confidentiality,
      tags: parseTagList(parsed.data.tags),
      processingInstructions: parsed.data.processingInstructions,
    });
    sourceId = result.source.id;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { error: error.message };
    }
    throw error;
  }

  // Ensure the in-process worker is polling so the queued job gets picked up.
  ensureJobRunnerStarted();

  redirect(`/c/${clientId}/sources/${sourceId}`);
}
