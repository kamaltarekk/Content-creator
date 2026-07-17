import { NextResponse } from "next/server";

import { AuthorizationError, UnauthenticatedError, requireAction } from "@/server/auth/permissions";
import { getSourceById } from "@/server/services/source.service";
import { storageProvider } from "@/server/providers/storage/local.storage.provider";

export async function GET(_request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await context.params;

  const source = await getSourceById(sourceId);
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  try {
    const session = await requireAction("source.download", { clientId: source.clientId });

    // Restricted sources require a trusted, org-wide role — not just per-client access.
    if (source.confidentiality === "RESTRICTED") {
      const trustedRoles = ["OWNER", "ADMIN", "STRATEGIST"];
      if (!session.user.orgRole || !trustedRoles.includes(session.user.orgRole)) {
        return NextResponse.json({ error: "This source is restricted." }, { status: 403 });
      }
    }
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    throw error;
  }

  const buffer = await storageProvider.read(source.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": source.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(source.originalFileName)}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
