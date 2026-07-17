"use client";

import { useActionState } from "react";

import { uploadSourceAction, type UploadSourceState } from "@/server/actions/source.actions";
import { SOURCE_CATEGORY_OPTIONS, CONFIDENTIALITY_OPTIONS } from "@/server/domain/source-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const nativeSelectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const initialState: UploadSourceState = { error: null };

export function UploadSourceForm({ clientId }: { clientId: string }) {
  const action = uploadSourceAction.bind(null, clientId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">File</Label>
        <Input id="file" name="file" type="file" required />
        <p className="text-xs text-muted-foreground">
          CSV, XLSX, PDF, DOCX, TXT, Markdown fully parsed. Images, audio, and video are accepted
          and stored but flagged as requiring multimodal processing.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sourceCategory">Source category</Label>
        <select
          id="sourceCategory"
          name="sourceCategory"
          defaultValue="STRATEGIC_FRAMEWORK"
          className={nativeSelectClassName}
        >
          {SOURCE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" placeholder="e.g. SPB Framework v3" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confidentiality">Confidentiality</Label>
        <select
          id="confidentiality"
          name="confidentiality"
          defaultValue="INTERNAL"
          className={nativeSelectClassName}
        >
          {CONFIDENTIALITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
        <Input id="tags" name="tags" placeholder="e.g. positioning, 2026" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="processingInstructions">Processing instructions (optional)</Label>
        <Textarea
          id="processingInstructions"
          name="processingInstructions"
          rows={2}
          placeholder="Anything the reviewer should know before classifying this source."
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Uploading…" : "Upload source"}
      </Button>
    </form>
  );
}
