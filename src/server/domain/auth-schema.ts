import { z } from "zod";

/**
 * A fresh sign-up always creates a brand-new Organization with the signer as
 * its OWNER — there's no shared-tenant self-serve joining flow (matching the
 * "invitations are a planned next step" limitation); joining an existing org
 * still happens via ClientMember/OrganizationMember rows created by an owner.
 */
export const SignUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(200),
    organizationName: z.string().trim().min(1, "Enter an organization name.").max(200),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof SignUpSchema>;
