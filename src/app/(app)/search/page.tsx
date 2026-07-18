import { requireUser } from "@/server/auth/permissions";
import { listClientOptionsForOrg } from "@/server/services/client.service";
import { SearchView } from "@/components/search/search-view";

export default async function SearchPage() {
  const session = await requireUser();
  const clients = session.user.orgId ? await listClientOptionsForOrg(session.user.orgId) : [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Search</p>
        <h1 className="text-2xl font-semibold text-foreground">Client-scoped search</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search within a single client across its sources, extracted items, and Client Brain. Results
          never cross client boundaries.
        </p>
      </div>
      <SearchView clients={clients} />
    </div>
  );
}
