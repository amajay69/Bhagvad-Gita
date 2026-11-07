import { NextResponse } from "next/server";
import { createEntry, journalDir, listEntries } from "@/lib/server/journal";
import { journalFailure, journalGuard } from "@/lib/server/journalHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ folder: journalDir(), entries: await listEntries() });
  } catch (e) {
    return journalFailure(e);
  }
}

export async function POST(req: Request) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    return NextResponse.json({ entry: await createEntry(body.text) });
  } catch (e) {
    return journalFailure(e);
  }
}
