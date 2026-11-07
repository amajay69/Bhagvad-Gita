import { NextResponse } from "next/server";
import { saveGuide, trashEntry, updateEntry } from "@/lib/server/journal";
import { journalFailure, journalGuard } from "@/lib/server/journalHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; guide?: unknown };
    // { guide } saves the guide's reply; { text } edits the entry
    return NextResponse.json({ entry: body.guide !== undefined ? await saveGuide(id, body.guide) : await updateEntry(id, body.text) });
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
