"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/server/auth/auth";
import { SignUpSchema } from "@/server/domain/auth-schema";
import { signUpNewOrganization, EmailAlreadyInUseError } from "@/server/services/signup.service";

export type SignInState = { error: string | null };

export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/overview",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." };
        default:
          return { error: "Something went wrong signing in. Please try again." };
      }
    }
    // Auth.js signals a successful redirect by throwing NEXT_REDIRECT — let it propagate.
    throw error;
  }
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/overview" });
}

export type SignUpState = { error: string | null; fieldErrors?: Record<string, string> };

export async function signUpAction(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: "Please fix the errors below.", fieldErrors };
  }

  try {
    await signUpNewOrganization(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { error: error.message, fieldErrors: { email: error.message } };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/overview",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please sign in." };
    }
    // Auth.js signals a successful redirect by throwing NEXT_REDIRECT — let it propagate.
    throw error;
  }
}
