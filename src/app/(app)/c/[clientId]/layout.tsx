import { notFound } from "next/navigation";

import { requireClientAccess } from "@/server/auth/permissions";
import { getClientById } from "@/server/services/client.service";
import { ClientNav } from "@/components/layout/client-nav";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const client = await getClientById(clientId);
  if (!client) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ClientNav clientId={client.id} clientName={client.displayName} brandType={client.brandType} />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
