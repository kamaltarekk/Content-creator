import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, CircleOff, AlertTriangle } from "lucide-react";

import { requireClientAccess } from "@/server/auth/permissions";
import { generateMissingDataReport, getCompletenessForClient } from "@/server/services/missingData.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletenessPanel } from "@/components/brain/completeness-panel";

export default async function MissingDataPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const [report, completeness] = await Promise.all([
    generateMissingDataReport(clientId),
    getCompletenessForClient(clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/c/${clientId}/brain`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Client Brain
      </Link>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Client Brain</p>
        <h1 className="text-2xl font-semibold text-foreground">Missing data report</h1>
      </div>

      <CompletenessPanel completeness={completeness} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-lime" />
              Strong coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.strong.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections are strongly covered yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {report.strong.map((s) => (
                  <li key={s.sectionKey}>{s.label}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDashed className="size-4 text-warning" />
              Needs more information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.partial.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing partially covered.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {report.partial.map((s) => (
                  <li key={s.sectionKey} className="flex justify-between">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground tabular-nums">{s.coveragePercent}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleOff className="size-4 text-muted-foreground" />
              Missing areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections are completely empty.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {report.missing.map((s) => (
                  <li key={s.sectionKey}>{s.label}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              Conflicting areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.conflicting.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open conflicts.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {report.conflicting.map((s) => (
                  <li key={s.sectionKey} className="flex justify-between">
                    <span>{s.label}</span>
                    <span className="text-warning tabular-nums">{s.count} open</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested follow-up questions</CardTitle>
        </CardHeader>
        <CardContent>
          {report.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outstanding questions — every critical field is covered.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.questions.map((q, index) => (
                <li key={index} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {q.sectionLabel} · {q.fieldLabel}
                  </span>
                  <span className="text-sm text-foreground">{q.question}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
