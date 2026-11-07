import { NextResponse } from "next/server";
import { saveGuide, saveStory, trashEntry, updateEntry } from "@/lib/server/journal";
import { journalFailure, journalGuard } from "@/lib/server/journalHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const blocked = journalGuard(req);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; guide?: unknown; story?: unknown };
    // { guide } saves the guide's reply, { story } a story for it; { text } edits the entry
    const entry = body.guide !== undefined ? await saveGuide(id, body.guide) : body.story !== undefined ? await saveStory(id, body.story) : await updateEntry(id, body.text);
    return NextResponse.json({ entry });
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
