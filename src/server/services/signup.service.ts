import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { slugify } from "@/server/domain/slug";
import type { SignUpInput } from "@/server/domain/auth-schema";

const BCRYPT_COST = 10;
const MAX_SLUG_ATTEMPTS = 20;

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailAlreadyInUseError";
  }
}

/** Finds an available organization slug, disambiguating collisions with a numeric suffix. */
async function findAvailableSlug(organizationName: string): Promise<string> {
  const base = slugify(organizationName);
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Self-serve sign-up: every new account gets its own brand-new Organization
 * with the signer as OWNER — there is no shared-tenant join flow yet.
 * Joining an existing org still only happens through an OrganizationMember/
 * ClientMember row an owner creates by hand.
 */
export async function signUpNewOrganization(input: SignUpInput): Promise<{ userId: string; organizationId: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new EmailAlreadyInUseError();

  const slug = await findAvailableSlug(input.organizationName);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });
    return { user, organization };
  });

  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Organization",
    entityId: organization.id,
    metadata: { signUp: true },
  });

  return { userId: user.id, organizationId: organization.id };
}
