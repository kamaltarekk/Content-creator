import { notFound } from "next/navigation";

import { getClientById } from "@/server/services/client.service";

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClientById(clientId);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Client Overview
      </p>
      <h1 className="text-2xl font-semibold text-foreground">{client.displayName}</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        {client.shortDescription ?? "No description yet."}
      </p>
    </div>
  );
}
