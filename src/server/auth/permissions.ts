import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/server/auth/auth";
import { ORG_WIDE_ROLES, ROLE_ACTIONS, type Action } from "@/server/domain/permission-matrix";

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

/**
 * Pure permission check: does this session grant `action`, optionally
 * scoped to a client? Org-wide roles (everything but CLIENT_APPROVER)
 * grant their actions for any client automatically. CLIENT_APPROVER only
 * grants access through an explicit ClientMember row on `session.user.clientRoles`.
 */
export function can(session: Session | null, action: Action, ctx?: { clientId?: string }): boolean {
  const user = session?.user;
  if (!user) return false;

  if (user.orgRole && ORG_WIDE_ROLES.includes(user.orgRole)) {
    if (ROLE_ACTIONS[user.orgRole].includes(action)) return true;
  }

  if (ctx?.clientId) {
    const clientRole = user.clientRoles[ctx.clientId];
    if (clientRole && ROLE_ACTIONS[clientRole].includes(action)) return true;
  }

  return false;
}

/** Does this session have any relationship to `clientId` at all (org-wide role, or an explicit ClientMember row)? */
export function hasClientAccess(session: Session | null, clientId: string): boolean {
  const user = session?.user;
  if (!user) return false;
  if (user.orgRole && ORG_WIDE_ROLES.includes(user.orgRole)) return true;
  return Boolean(user.clientRoles[clientId]);
}

export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
}

export async function requireClientAccess(clientId: string): Promise<Session> {
  const session = await requireUser();
  if (!hasClientAccess(session, clientId)) {
    throw new AuthorizationError(`No access to client ${clientId}`);
  }
  return session;
}

export async function requireAction(action: Action, ctx?: { clientId?: string }): Promise<Session> {
  const session = await requireUser();
  if (!can(session, action, ctx)) {
    throw new AuthorizationError(`Missing permission: ${action}`);
  }
  return session;
}
