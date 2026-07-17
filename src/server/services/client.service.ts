import "server-only";

import { prisma } from "@/server/db/prisma";

export function getClientById(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
  });
}
