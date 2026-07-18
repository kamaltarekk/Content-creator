"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { signInAction, signInWithGoogleAction, type SignInState } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const initialState: SignInState = { error: null };

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "No account found for that Google email. Ask an admin to invite you first.",
};

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  return (
    <div className="flex flex-col gap-4">
      {googleEnabled && (
        <>
          <form action={signInWithGoogleAction}>
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>

          {oauthError && (
            <p role="alert" className="text-sm text-destructive">
              {OAUTH_ERROR_MESSAGES[oauthError] ?? "Something went wrong signing in with Google. Please try again."}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@agency.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
