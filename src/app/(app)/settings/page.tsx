import { requireUser } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await requireUser();
  const org = session.user.orgId
    ? await prisma.organization.findUnique({ where: { id: session.user.orgId } })
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Settings</p>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Your workspace details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{org?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="text-foreground">{org?.slug ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="text-foreground">{session.user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="text-foreground">{session.user.orgRole ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI &amp; processing</CardTitle>
          <CardDescription>How sources are processed in this deployment.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>Fully parsed formats: CSV, XLSX, TXT, Markdown, DOCX, text-based PDF.</li>
            <li>Image / audio / video are accepted and stored but flagged for multimodal processing.</li>
            <li>
              AI classification uses the configured provider ({process.env.OPENAI_MODEL || "gpt-4.1-mini"}). It
              never writes to the Client Brain without human review.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
