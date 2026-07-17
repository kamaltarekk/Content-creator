import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium tracking-wide text-lime uppercase">
          Commercial Attention OS
        </p>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Access your client workspaces.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
