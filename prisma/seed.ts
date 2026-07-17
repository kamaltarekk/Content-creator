import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-agency" },
    update: {},
    create: {
      name: "Demo Agency",
      slug: "demo-agency",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo-agency.test" },
    update: {},
    create: {
      name: "Kamal Tarek",
      email: "owner@demo-agency.test",
      passwordHash,
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: owner.id } },
    update: { role: "OWNER" },
    create: {
      organizationId: org.id,
      userId: owner.id,
      role: "OWNER",
    },
  });

  console.log("Seeded organization %s with owner %s", org.slug, owner.email);
  console.log("Sign in with owner@demo-agency.test / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
