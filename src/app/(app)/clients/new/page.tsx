import { AuthorizationError, requireAction } from "@/server/auth/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateClientForm } from "@/components/clients/create-client-form";

export default async function NewClientPage() {
  try {
    await requireAction("client.create");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="p-6">
          <p className="text-sm text-destructive">
            You don&apos;t have permission to create clients.
          </p>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Clients</p>
        <h1 className="text-2xl font-semibold text-foreground">Create a new client</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>
            You&apos;ll be able to upload your first source right after creating the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
