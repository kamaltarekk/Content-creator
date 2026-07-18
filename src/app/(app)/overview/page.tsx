import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Building2, FileClock, ClipboardCheck, AlertTriangle } from "lucide-react";

import { requireUser } from "@/server/auth/permissions";
import { getOrgDashboard } from "@/server/services/overview.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AUDIT_VERB: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  APPROVE: "approved",
  REJECT: "rejected",
  MAP: "remapped",
  ARCHIVE: "archived",
  SOFT_DELETE: "deleted",
  CONFLICT_RESOLVE: "resolved a conflict on",
  LOGIN: "signed in",
  LOGOUT: "signed out",
};

export default async function OverviewPage() {
  const session = await requireUser();
  if (!session.user.orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Your account is not attached to an organization.</p>
      </div>
    );
  }

  const dashboard = await getOrgDashboard(session.user.orgId);

  const stats = [
    { label: "Active clients", value: dashboard.activeClients, icon: Building2, href: "/clients" },
    { label: "Files awaiting processing", value: dashboard.filesAwaitingProcessing, icon: FileClock },
    { label: "Reviews awaiting approval", value: dashboard.reviewsAwaitingApproval, icon: ClipboardCheck },
    {
      label: "Client Brain conflicts",
      value: dashboard.openConflicts,
      icon: AlertTriangle,
      warning: dashboard.openConflicts > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Overview</p>
          <h1 className="text-2xl font-semibold text-foreground">Workspace overview</h1>
        </div>
        <Button asChild>
          <Link href="/clients/new">Create New Client</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const card = (
            <Card className="py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-elevated">
                  <Icon className={stat.warning ? "size-4 text-warning" : "size-4 text-muted-foreground"} />
                </div>
                <div>
                  <p className={stat.warning ? "text-2xl font-semibold text-warning" : "text-2xl font-semibold text-foreground"}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently updated clients</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dashboard.recentClients.map((client) => (
                  <li key={client.id}>
                    <Link
                      href={`/c/${client.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-elevated/50"
                    >
                      <span className="text-foreground">{client.displayName}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {client.status === "ARCHIVED" && <Badge variant="muted">Archived</Badge>}
                        {formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {dashboard.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground">
                      <span className="font-medium">{entry.actorName}</span>{" "}
                      {AUDIT_VERB[entry.action] ?? entry.action.toLowerCase()}{" "}
                      <span className="text-muted-foreground">{entry.entityType}</span>
                      {entry.clientName && <span className="text-muted-foreground"> · {entry.clientName}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
