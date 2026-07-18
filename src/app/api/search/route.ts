import { NextResponse } from "next/server";

import { AuthorizationError, UnauthenticatedError, requireClientAccess } from "@/server/auth/permissions";
import { searchClient } from "@/server/services/search.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const query = url.searchParams.get("q") ?? "";

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    await requireClientAccess(clientId);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    throw error;
  }

  const results = await searchClient(clientId, query);
  return NextResponse.json({ results });
}
