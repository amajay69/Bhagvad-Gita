import { NextResponse } from "next/server";
import { isLocalRequest } from "./guard";
import { JournalError } from "./journal";

export const NOT_LOCAL = "Your journal opens only on the computer where Gita Manan is running. Open it at http://localhost:3000.";

/** The journal is private: only requests made on this computer are served (never other devices on the Wi-Fi). */
export function journalGuard(req: Request): NextResponse | null {
  return isLocalRequest(req) ? null : NextResponse.json({ error: NOT_LOCAL }, { status: 403 });
}

export function journalFailure(e: unknown): NextResponse {
  if (e instanceof JournalError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: `The journal folder could not be used: ${(e as Error).message}` }, { status: 500 });
}
