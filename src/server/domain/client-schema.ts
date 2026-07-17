import { z } from "zod";

export const BRAND_TYPE_OPTIONS = [
  { value: "PERSONAL_BRAND", label: "Personal Brand" },
  { value: "COMPANY_BRAND", label: "Company Brand" },
  { value: "HYBRID", label: "Hybrid" },
] as const;

export const clientFormSchema = z.object({
  name: z
    .string()
    .min(2, "Client name must be at least 2 characters.")
    .max(120, "Client name is too long."),
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters.")
    .max(120, "Display name is too long."),
  brandType: z.enum(["PERSONAL_BRAND", "COMPANY_BRAND", "HYBRID"]),
  primaryMarket: z.string().max(120).optional().or(z.literal("")),
  defaultLanguage: z.string().min(2, "Required").max(10),
  timeZone: z.string().min(1, "Required").max(60),
  shortDescription: z.string().max(500).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
