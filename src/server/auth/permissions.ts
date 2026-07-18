import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/server/auth/auth";
import { can, hasClientAccess, type Action } from "@/server/domain/permission-matrix";

export { can, hasClientAccess };
export type { Action };

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
}

export async function requireClientAccess(clientId: string): Promise<Session> {
  const session = await requireUser();
  if (!hasClientAccess(session.user, clientId)) {
    throw new AuthorizationError(`No access to client ${clientId}`);
  }
  return session;
}

export async function requireAction(action: Action, ctx?: { clientId?: string }): Promise<Session> {
  const session = await requireUser();
  if (!can(session.user, action, ctx)) {
    throw new AuthorizationError(`Missing permission: ${action}`);
  }
  return session;
}
