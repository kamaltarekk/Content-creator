import type { ClientRole, OrgRole } from "@prisma/client";

/**
 * Minimal shape the pure permission functions need. Matches the session user
 * carried in the Auth.js JWT (see types/next-auth.d.ts) but avoids importing
 * next-auth here so this module stays dependency-free and unit-testable.
 */
export type PermissionSubject = {
  orgRole: OrgRole | null;
  clientRoles: Record<string, ClientRole>;
} | null;

/**
 * All actions the app authorizes. Every server action / route handler must
 * call requireAction() (see server/auth/permissions.ts) with one of these
 * before doing anything — component-level role checks are UX-only.
 */
export type Action =
  | "client.create"
  | "client.edit"
  | "client.archive"
  | "source.upload"
  | "source.download"
  | "source.delete"
  | "review.approve"
  | "review.approve.conflict"
  | "brain.view"
  | "brain.edit.draft"
  | "brain.edit.active"
  | "conflict.resolve"
  | "team.manage"
  | "strategy.view"
  | "strategy.edit"
  | "strategy.approve"
  | "strategy.approve.conflict"
  | "strategy.suggest"
  | "setup.view"
  | "setup.edit"
  | "setup.approve"
  | "reel.generate"
  | "reel.approve";

const ALL_ACTIONS: Action[] = [
  "client.create",
  "client.edit",
  "client.archive",
  "source.upload",
  "source.download",
  "source.delete",
  "review.approve",
  "review.approve.conflict",
  "brain.view",
  "brain.edit.draft",
  "brain.edit.active",
  "conflict.resolve",
  "team.manage",
  "strategy.view",
  "strategy.edit",
  "strategy.approve",
  "strategy.approve.conflict",
  "strategy.suggest",
  "setup.view",
  "setup.edit",
  "setup.approve",
  "reel.generate",
  "reel.approve",
];

/**
 * OrgRole and ClientRole share the same member set, so one map covers both:
 * an OrgRole grants its actions org-wide (across every client in the org),
 * a ClientRole (via an explicit ClientMember row) grants its actions only
 * for that one client. CLIENT_APPROVER is deliberately excluded from
 * org-wide grants — see `can()` in permissions.ts — an org-level
 * CLIENT_APPROVER membership alone grants no client access; only an
 * explicit ClientMember row does, satisfying "cannot access other clients."
 */
export const ROLE_ACTIONS: Record<OrgRole | ClientRole, Action[]> = {
  OWNER: ALL_ACTIONS,
  ADMIN: ALL_ACTIONS,
  STRATEGIST: [
    "client.create",
    "client.edit",
    "source.upload",
    "source.download",
    "source.delete",
    "review.approve",
    "review.approve.conflict",
    "brain.view",
    "brain.edit.draft",
    "brain.edit.active",
    "conflict.resolve",
    "strategy.view",
    "strategy.edit",
    "strategy.approve",
    "strategy.approve.conflict",
    "strategy.suggest",
    "setup.view",
    "setup.edit",
    "setup.approve",
    "reel.generate",
    "reel.approve",
  ],
  EDITOR: [
    "brain.view",
    "brain.edit.draft",
    "review.approve",
    "source.download",
    "strategy.view",
    "strategy.edit",
    "setup.view",
    "setup.edit",
    "reel.generate",
  ],
  VIEWER: ["brain.view", "source.download", "strategy.view", "setup.view"],
  CLIENT_APPROVER: [
    "brain.view",
    "review.approve",
    "review.approve.conflict",
    "conflict.resolve",
    "strategy.view",
    "strategy.approve",
    "strategy.approve.conflict",
    "setup.view",
    "setup.approve",
    "reel.approve",
  ],
};

/** Org roles that inherently apply to every client in the org (no ClientMember row needed). */
export const ORG_WIDE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "STRATEGIST", "EDITOR", "VIEWER"];

/**
 * Pure permission check: does this subject grant `action`, optionally scoped
 * to a client? Org-wide roles (everything but CLIENT_APPROVER) grant their
 * actions for any client automatically. CLIENT_APPROVER only grants access
 * through an explicit ClientMember row in `clientRoles`.
 */
export function can(subject: PermissionSubject, action: Action, ctx?: { clientId?: string }): boolean {
  if (!subject) return false;

  if (subject.orgRole && ORG_WIDE_ROLES.includes(subject.orgRole)) {
    if (ROLE_ACTIONS[subject.orgRole].includes(action)) return true;
  }

  if (ctx?.clientId) {
    const clientRole = subject.clientRoles[ctx.clientId];
    if (clientRole && ROLE_ACTIONS[clientRole].includes(action)) return true;
  }

  return false;
}

/** Does this subject have any relationship to `clientId` (org-wide role, or an explicit ClientMember row)? */
export function hasClientAccess(subject: PermissionSubject, clientId: string): boolean {
  if (!subject) return false;
  if (subject.orgRole && ORG_WIDE_ROLES.includes(subject.orgRole)) return true;
  return Boolean(subject.clientRoles[clientId]);
}
