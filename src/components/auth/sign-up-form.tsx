"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signUpAction, type SignUpState } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignUpState = { error: null };

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const fieldError = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required placeholder="Jane Doe" />
        {fieldError.name && <p className="text-xs text-destructive">{fieldError.name}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="organizationName">Agency / organization name</Label>
        <Input
          id="organizationName"
          name="organizationName"
          type="text"
          autoComplete="organization"
          required
          placeholder="Acme Growth Partners"
        />
        {fieldError.organizationName && <p className="text-xs text-destructive">{fieldError.organizationName}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@agency.com" />
        {fieldError.email && <p className="text-xs text-destructive">{fieldError.email}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
        {fieldError.password && <p className="text-xs text-destructive">{fieldError.password}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
        {fieldError.confirmPassword && <p className="text-xs text-destructive">{fieldError.confirmPassword}</p>}
      </div>
      {state.error && !Object.keys(fieldError).length && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Creating your workspace…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
