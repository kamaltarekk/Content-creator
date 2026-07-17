"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { clientFormSchema, type ClientFormValues } from "@/server/domain/client-schema";
import * as clientService from "@/server/services/client.service";

export async function createClientAction(input: ClientFormValues) {
  const session = await requireAction("client.create");
  if (!session.user.orgId) {
    throw new Error("Your account is not attached to an organization.");
  }

  const parsed = clientFormSchema.parse(input);

  let client;
  try {
    client = await clientService.createClient(session.user.orgId, session.user.id, parsed);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A client with that name already exists in this organization.");
    }
    throw error;
  }

  revalidatePath("/clients");
  return { clientId: client.id };
}

export async function updateClientAction(clientId: string, input: Omit<ClientFormValues, "name">) {
  const session = await requireAction("client.edit", { clientId });
  if (!session.user.orgId) {
    throw new Error("Your account is not attached to an organization.");
  }

  const parsed = clientFormSchema.omit({ name: true }).parse(input);

  await clientService.updateClient(clientId, session.user.id, session.user.orgId, parsed);

  revalidatePath("/clients");
  revalidatePath(`/c/${clientId}`);
}

export async function archiveClientAction(clientId: string) {
  const session = await requireAction("client.archive", { clientId });
  if (!session.user.orgId) {
    throw new Error("Your account is not attached to an organization.");
  }

  await clientService.archiveClient(clientId, session.user.id, session.user.orgId);
  revalidatePath("/clients");
}
