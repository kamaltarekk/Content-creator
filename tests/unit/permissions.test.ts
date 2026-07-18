import { describe, expect, it } from "vitest";
import type { ClientRole, OrgRole } from "@prisma/client";

import { can, hasClientAccess, type PermissionSubject } from "@/server/domain/permission-matrix";

function sessionWith(
  orgRole: OrgRole,
  clientRoles: Record<string, ClientRole> = {},
): PermissionSubject {
  return { orgRole, clientRoles };
}

describe("permission checks", () => {
  it("OWNER can do everything org-wide", () => {
    const session = sessionWith("OWNER");
    expect(can(session, "client.create")).toBe(true);
    expect(can(session, "review.approve.conflict", { clientId: "any" })).toBe(true);
    expect(can(session, "team.manage")).toBe(true);
  });

  it("STRATEGIST can review and edit the brain but not manage the team", () => {
    const session = sessionWith("STRATEGIST");
    expect(can(session, "review.approve", { clientId: "c1" })).toBe(true);
    expect(can(session, "brain.edit.active", { clientId: "c1" })).toBe(true);
    expect(can(session, "team.manage")).toBe(false);
  });

  it("EDITOR cannot approve conflicts or edit active brain items", () => {
    const session = sessionWith("EDITOR");
    expect(can(session, "brain.edit.draft", { clientId: "c1" })).toBe(true);
    expect(can(session, "review.approve", { clientId: "c1" })).toBe(true);
    expect(can(session, "review.approve.conflict", { clientId: "c1" })).toBe(false);
    expect(can(session, "brain.edit.active", { clientId: "c1" })).toBe(false);
    expect(can(session, "conflict.resolve", { clientId: "c1" })).toBe(false);
  });

  it("VIEWER is read-only", () => {
    const session = sessionWith("VIEWER");
    expect(can(session, "brain.view", { clientId: "c1" })).toBe(true);
    expect(can(session, "source.upload", { clientId: "c1" })).toBe(false);
    expect(can(session, "review.approve", { clientId: "c1" })).toBe(false);
  });

  it("CLIENT_APPROVER at org level alone grants no client access", () => {
    const session = sessionWith("CLIENT_APPROVER");
    expect(hasClientAccess(session, "c1")).toBe(false);
    expect(can(session, "review.approve", { clientId: "c1" })).toBe(false);
  });

  it("CLIENT_APPROVER gains scoped access only via an explicit ClientMember row", () => {
    const session = sessionWith("CLIENT_APPROVER", { c1: "CLIENT_APPROVER" });
    expect(hasClientAccess(session, "c1")).toBe(true);
    expect(hasClientAccess(session, "c2")).toBe(false);
    expect(can(session, "review.approve", { clientId: "c1" })).toBe(true);
    expect(can(session, "review.approve.conflict", { clientId: "c1" })).toBe(true);
    // No access at all to a client they aren't a member of.
    expect(can(session, "review.approve", { clientId: "c2" })).toBe(false);
  });

  it("an org-wide role still applies when a client-specific role is absent", () => {
    const session = sessionWith("ADMIN");
    expect(hasClientAccess(session, "anything")).toBe(true);
    expect(can(session, "conflict.resolve", { clientId: "anything" })).toBe(true);
  });

  it("denies everything for an unauthenticated (null) session", () => {
    expect(can(null, "brain.view", { clientId: "c1" })).toBe(false);
    expect(hasClientAccess(null, "c1")).toBe(false);
  });

  it("STRATEGIST has full strategy permissions including conflict approval and suggestion", () => {
    const session = sessionWith("STRATEGIST");
    expect(can(session, "strategy.view", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.edit", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.approve", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.approve.conflict", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.suggest", { clientId: "c1" })).toBe(true);
  });

  it("EDITOR can view/edit strategy drafts but cannot approve disputed beliefs or resolve conflicts", () => {
    const session = sessionWith("EDITOR");
    expect(can(session, "strategy.view", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.edit", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.approve", { clientId: "c1" })).toBe(false);
    expect(can(session, "strategy.approve.conflict", { clientId: "c1" })).toBe(false);
  });

  it("VIEWER can only view strategy", () => {
    const session = sessionWith("VIEWER");
    expect(can(session, "strategy.view", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.edit", { clientId: "c1" })).toBe(false);
  });

  it("CLIENT_APPROVER can view and approve strategy (incl. conflicts) only for its assigned client", () => {
    const session = sessionWith("CLIENT_APPROVER", { c1: "CLIENT_APPROVER" });
    expect(can(session, "strategy.approve", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.approve.conflict", { clientId: "c1" })).toBe(true);
    expect(can(session, "strategy.edit", { clientId: "c1" })).toBe(false);
    expect(can(session, "strategy.approve", { clientId: "c2" })).toBe(false);
  });
});
