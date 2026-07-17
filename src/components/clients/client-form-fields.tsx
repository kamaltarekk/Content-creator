"use client";

import type { UseFormReturn } from "react-hook-form";

import { BRAND_TYPE_OPTIONS, type ClientFormValues } from "@/server/domain/client-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Shared field set for create + edit client forms. `includeName` controls whether the immutable slug-like `name` field is editable (create only). */
export function ClientFormFields({
  form,
  includeName,
}: {
  form: UseFormReturn<ClientFormValues>;
  includeName: boolean;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4">
      {includeName && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Client name</Label>
          <Input id="name" placeholder="e.g. Kamal Ghamry" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" placeholder="Shown throughout the workspace" {...register("displayName")} />
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brandType">Brand type</Label>
        <Select
          value={watch("brandType")}
          onValueChange={(value) => setValue("brandType", value as ClientFormValues["brandType"], { shouldValidate: true })}
        >
          <SelectTrigger id="brandType" className="w-full">
            <SelectValue placeholder="Select a brand type" />
          </SelectTrigger>
          <SelectContent>
            {BRAND_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.brandType && <p className="text-xs text-destructive">{errors.brandType.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="primaryMarket">Primary market</Label>
          <Input id="primaryMarket" placeholder="e.g. Egypt" {...register("primaryMarket")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="defaultLanguage">Default language</Label>
          <Input id="defaultLanguage" placeholder="en" {...register("defaultLanguage")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timeZone">Time zone</Label>
        <Input id="timeZone" placeholder="Africa/Cairo" {...register("timeZone")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shortDescription">Short description (optional)</Label>
        <Textarea
          id="shortDescription"
          rows={3}
          placeholder="A one or two sentence summary of this client."
          {...register("shortDescription")}
        />
      </div>
    </div>
  );
}
