import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/server/auth/auth.config";
import { prisma } from "@/server/db/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (!user) return null;

      const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!passwordMatches) return null;

      return { id: user.id, name: user.name, email: user.email };
    },
  }),
];

// Google is only wired up when configured — an unconfigured provider must
// never be able to break Credentials sign-in for everyone else.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // There's no self-serve signup — Google can only sign in an email that
      // already has a User row (created via seed or a future invite flow),
      // never provision a new, org-less account.
      if (account?.provider === "google") {
        if (!user.email) return false;
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        return Boolean(existing);
      }
      return true;
    },
    async jwt({ token, user }) {
      // Resolve the real Prisma User by email for every provider — for
      // Credentials, user.id is already ours; for Google, the provider's id
      // isn't ours, so email is the only reliable link to the existing row.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (!dbUser) return token;

        token.userId = dbUser.id;

        const [membership, clientMemberships] = await Promise.all([
          prisma.organizationMember.findFirst({
            where: { userId: dbUser.id },
            orderBy: { createdAt: "asc" },
          }),
          prisma.clientMember.findMany({ where: { userId: dbUser.id } }),
        ]);

        token.orgId = membership?.organizationId ?? null;
        token.orgRole = membership?.role ?? null;
        token.clientRoles = Object.fromEntries(
          clientMemberships.map((membership) => [membership.clientId, membership.role]),
        );
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? "";
      session.user.orgId = token.orgId ?? null;
      session.user.orgRole = token.orgRole ?? null;
      session.user.clientRoles = token.clientRoles ?? {};
      return session;
    },
  },
});
