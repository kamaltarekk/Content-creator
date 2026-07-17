import type { ClientRole, OrgRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augmenting "@auth/core/types" and "@auth/core/jwt" directly rather than
// "next-auth"/"next-auth/jwt": those next-auth entry points just re-export
// (`export * from "@auth/core/..."`), and TypeScript module augmentation
// does not merge through a re-export barrel — it has to target the module
// where the interface is actually declared.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      orgRole: OrgRole | null;
      clientRoles: Record<string, ClientRole>;
    } & DefaultSession["user"];
  }

  interface User {
    orgId?: string | null;
    orgRole?: OrgRole | null;
    clientRoles?: Record<string, ClientRole>;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    orgId?: string | null;
    orgRole?: OrgRole | null;
    clientRoles?: Record<string, ClientRole>;
  }
}
