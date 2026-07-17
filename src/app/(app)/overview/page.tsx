export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Overview</p>
      <h1 className="text-2xl font-semibold text-foreground">Workspace overview</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        The full dashboard (active clients, pending reviews, conflicts, recent activity) lands in a
        later milestone. Head to Clients to get started.
      </p>
    </div>
  );
}
