import { requireAction } from "@/server/auth/permissions";
import { StrategyNav } from "@/components/layout/strategy-nav";

export default async function StrategyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireAction("strategy.view", { clientId });

  return (
    <div className="flex flex-col gap-4">
      <StrategyNav clientId={clientId} />
      {children}
    </div>
  );
}
