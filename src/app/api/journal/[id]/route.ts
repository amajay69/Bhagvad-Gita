import { NextResponse } from "next/server";
import { trashEntry, updateEntry } from "@/lib/server/journal";
import { journalFailure, journalGuard } from "@/lib/server/journalHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    return NextResponse.json({ entry: await updateEntry(id, body.text) });
  } catch (e) {
    return journalFailure(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    await trashEntry(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return journalFailure(e);
  }
}
