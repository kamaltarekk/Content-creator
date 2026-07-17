import type { ClientRole, OrgRole } from "@prisma/client";

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
  | "review.approve"
  | "review.approve.conflict"
  | "brain.view"
  | "brain.edit.draft"
  | "brain.edit.active"
  | "conflict.resolve"
  | "team.manage";

const ALL_ACTIONS: Action[] = [
  "client.create",
  "client.edit",
  "client.archive",
  "source.upload",
  "source.download",
  "review.approve",
  "review.approve.conflict",
  "brain.view",
  "brain.edit.draft",
  "brain.edit.active",
  "conflict.resolve",
  "team.manage",
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
    "review.approve",
    "review.approve.conflict",
    "brain.view",
    "brain.edit.draft",
    "brain.edit.active",
    "conflict.resolve",
  ],
  EDITOR: ["brain.view", "brain.edit.draft", "review.approve", "source.download"],
  VIEWER: ["brain.view", "source.download"],
  CLIENT_APPROVER: ["brain.view", "review.approve", "review.approve.conflict", "conflict.resolve"],
};

/** Org roles that inherently apply to every client in the org (no ClientMember row needed). */
export const ORG_WIDE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "STRATEGIST", "EDITOR", "VIEWER"];
