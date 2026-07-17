import Link from "next/link";

import { requireUser } from "@/server/auth/permissions";
import { listClientsForOrg } from "@/server/services/client.service";
import { Button } from "@/components/ui/button";
import { ClientsTable } from "@/components/clients/clients-table";

export default async function ClientsPage() {
  const session = await requireUser();
  const clients = session.user.orgId ? await listClientsForOrg(session.user.orgId) : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Clients</p>
          <h1 className="text-2xl font-semibold text-foreground">Client workspaces</h1>
        </div>
        <Button asChild>
          <Link href="/clients/new">Create New Client</Link>
        </Button>
      </div>
      <ClientsTable clients={clients} />
    </div>
  );
}
