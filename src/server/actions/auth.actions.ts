"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/server/auth/auth";

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
