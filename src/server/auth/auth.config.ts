import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the Auth.js config: no Prisma import, used by
 * middleware.ts (which runs on the Edge runtime) purely for JWT-presence
 * route protection. Fine-grained authorization always happens server-side
 * in server/auth/permissions.ts, never here.
 */
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isPublicAuthPage = nextUrl.pathname.startsWith("/sign-in") || nextUrl.pathname.startsWith("/sign-up");

      if (isPublicAuthPage) {
        return isLoggedIn ? Response.redirect(new URL("/overview", nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
