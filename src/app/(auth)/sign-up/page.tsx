import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium tracking-wide text-lime uppercase">
          Commercial Attention OS
        </p>
        <CardTitle className="text-xl">Create your workspace</CardTitle>
        <CardDescription>Sets up a new organization with you as the owner.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
