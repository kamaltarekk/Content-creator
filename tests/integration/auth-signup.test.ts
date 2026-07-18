import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { signUpNewOrganization, EmailAlreadyInUseError } from "@/server/services/signup.service";

const RUN_ID = `signup-${process.pid}-${process.hrtime()[1]}`;
const orgIds: string[] = [];
const userIds: string[] = [];

afterAll(async () => {
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("signUpNewOrganization (integration)", () => {
  it("creates a brand-new Organization + User + OWNER membership", async () => {
    const result = await signUpNewOrganization({
      name: "Jane Doe",
      organizationName: `Acme Growth ${RUN_ID}`,
      email: `jane-${RUN_ID}@example.com`,
      password: "supersecret",
      confirmPassword: "supersecret",
    });
    orgIds.push(result.organizationId);
    userIds.push(result.userId);

    const membership = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: result.organizationId, userId: result.userId } },
    });
    expect(membership.role).toBe("OWNER");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.passwordHash).not.toBe("supersecret");
    expect(user.passwordHash.length).toBeGreaterThan(20);

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: result.organizationId } });
    expect(org.slug).toContain("acme-growth");
  });

  it("rejects a sign-up whose email is already in use", async () => {
    const email = `dupe-${RUN_ID}@example.com`;
    const first = await signUpNewOrganization({
      name: "First User",
      organizationName: `First Org ${RUN_ID}`,
      email,
      password: "supersecret",
      confirmPassword: "supersecret",
    });
    orgIds.push(first.organizationId);
    userIds.push(first.userId);

    await expect(
      signUpNewOrganization({
        name: "Second User",
        organizationName: `Second Org ${RUN_ID}`,
        email,
        password: "anotherpass",
        confirmPassword: "anotherpass",
      }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it("disambiguates a colliding organization slug instead of failing", async () => {
    const orgName = `Collision Org ${RUN_ID}`;
    const first = await signUpNewOrganization({
      name: "First",
      organizationName: orgName,
      email: `collision-1-${RUN_ID}@example.com`,
      password: "supersecret",
      confirmPassword: "supersecret",
    });
    const second = await signUpNewOrganization({
      name: "Second",
      organizationName: orgName,
      email: `collision-2-${RUN_ID}@example.com`,
      password: "supersecret",
      confirmPassword: "supersecret",
    });
    orgIds.push(first.organizationId, second.organizationId);
    userIds.push(first.userId, second.userId);

    const [firstOrg, secondOrg] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: first.organizationId } }),
      prisma.organization.findUniqueOrThrow({ where: { id: second.organizationId } }),
    ]);
    expect(firstOrg.slug).not.toBe(secondOrg.slug);
  });
});
