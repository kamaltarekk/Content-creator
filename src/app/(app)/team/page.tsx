import { requireUser } from "@/server/auth/permissions";
import { getTeamData } from "@/server/services/overview.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function TeamPage() {
  const session = await requireUser();
  const team = session.user.orgId
    ? await getTeamData(session.user.orgId)
    : { orgMembers: [], clientAssignments: [] };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Team</p>
        <h1 className="text-2xl font-semibold text-foreground">Team &amp; roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Organization roles apply across every client; client assignments (used for CLIENT_APPROVER)
          scope access to a single client. Invitations and role changes are a planned next step.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization members</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.orgMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-5 font-medium text-foreground">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client assignments</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {team.clientAssignments.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No client-specific assignments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Client</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.clientAssignments.map((assignment, index) => (
                  <TableRow key={index}>
                    <TableCell className="pl-5 font-medium text-foreground">{assignment.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{assignment.memberName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{assignment.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
