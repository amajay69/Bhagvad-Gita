"use client";
// "Sit with the guide": what the Gita says about one journal entry, in layers.
// Verse wording always comes from the verified verse data; the model only explains how a verse speaks to the entry.
import { useState } from "react";
import { BookOpenText, HeartHandshake, RotateCw, Sparkles } from "lucide-react";
import { useGita } from "@/lib/store/useGitaStore";
import { currentConnection, useConnection, useSettings } from "@/lib/store/settingsStore";
import { PROVIDERS } from "@/lib/llm/providers";
import { streamFromApi } from "@/lib/llm/browser";
import { retrieve, type RagContext } from "@/lib/graphrag/engine";
import { CRISIS_RESOURCES, detectCrisis } from "@/lib/graphrag/safety";
import { parseGuide } from "@/lib/guide/parse";
import { guideContext, guideThemes } from "@/lib/guide/context";
import { expandForSearch } from "@/lib/guide/hinglish";
import { embedQuery } from "@/lib/graphrag/search";
import { parseStory } from "@/lib/guide/story";
import type { GuideReply } from "@/lib/guide/parse";

export interface StoryRecord {
  at: string;
  via: string;
  text: string;
}

export interface GuideRecord {
  at: string;
  via: string;
  text: string;
  refs: string[];
  story?: StoryRecord;
}

/** "Explain with a story": optional, told for the guide's current reply and saved with it. */
function StoryPart({ ctx, entryId, text, reply, story, onSaved }: { ctx: RagContext; entryId: string; text: string; reply: GuideReply; story?: StoryRecord; onSaved: (s: StoryRecord) => void }) {
  const conn = useConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tell = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const def = String(ctx.versesDoc.meta.defaults.en);
      const verses = reply.verses.map((v) => `[BG ${v.ref}] Meaning: ${(ctx.versesById.get(v.id)?.translations.en?.[def] || "").replace(/\s+/g, " ").trim()}\nGuide's note: ${v.note}`);
      const context = `# The guide's reflection\n${reply.mirror}\n\n# The verses the guide chose\n${verses.join("\n\n")}\n\n# The step the guide suggested\n${reply.action}`;
      const res = await streamFromApi({ mode: "story", question: text, context });
      if (!res.ok || !res.text.trim()) throw new Error(`The AI could not be reached (${res.error || "empty reply"}).`);
      const record = { via: `${res.provider}, ${res.model}`, text: res.text.trim() };
      const put = await fetch(`/api/journal/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: record }) });
      const data = (await put.json().catch(() => ({}))) as { entry?: { guide?: GuideRecord }; error?: string };
      if (put.ok && data.entry?.guide?.story) onSaved(data.entry.guide.story);
      else {
        onSaved({ ...record, at: new Date().toISOString() });
        setError(`Shown, but not saved: ${data.error || `HTTP ${put.status}`}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const s = story ? parseStory(story.text) : null;
  return (
    <div>
      {s && (
        <div className="rounded-[var(--radius-2)] border border-line p-3">
          {s.ok ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="text-[15px] font-semibold text-text">{s.title || "A story"}</div>
                <div className="text-[12px] text-text-3">Source: {s.source}</div>
              </div>
              <div className="serif mt-2 space-y-2 text-[15px] leading-[1.65] text-text">
                {s.story
                  .split(/\n\s*\n|\n/)
                  .filter((x) => x.trim())
                  .map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
              </div>
              {s.link && <p className="mt-3 text-[14px] leading-[1.6] text-text-2">{s.link}</p>}
            </>
          ) : (
            <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-text">{story!.text}</p>
          )}
          <p className="mt-3 text-[11.5px] leading-4 text-text-3">Retold by AI ({story!.via}). The source is as the AI states it; if it matters to you, please check it.</p>
        </div>
      )}
      {conn && (
        <button className="btn btn-sm mt-2" onClick={tell} disabled={busy}>
          <BookOpenText size={14} /> {busy ? "Finding a story…" : s ? "Another story" : "Explain with a story"}
        </button>
      )}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}

interface Offline {
  verses: string[];
  refs: string[];
  note: string;
}

function CrisisNotice() {
  return (
    <div className="rounded-3 border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-soft p-4" role="alert">
      <div className="flex items-center gap-2 text-danger">
        <HeartHandshake size={16} />
        <span className="text-[13.5px] font-semibold">Please talk to someone today</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-5 text-text-2">What you are carrying sounds very heavy. A person can help right now:</p>
      <ul className="mt-2 space-y-0.5 text-[13px]">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.label}>
            <span className="text-text-3">{r.label}: </span>
            <span className="font-semibold text-text">{r.contact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function verseText(ctx: RagContext, id: string): string {
  const v = ctx.versesById.get(id);
  if (!v) return "";
  const def = String(ctx.versesDoc.meta.defaults.en);
  return (v.translations.en?.[def] || Object.values(v.translations.en || {})[0] || "").replace(/\s+/g, " ").trim();
}

function VerseBlock({ ctx, id, note }: { ctx: RagContext; id: string; note: string }) {
  const v = ctx.versesById.get(id);
  return (
    <li>
      <div className="text-[12.5px] font-semibold text-accent-text">BG {v?.ref ?? id.replace("BG_", "")}</div>
      <blockquote className="serif mt-1 border-l-2 border-line-2 pl-3 text-[15px] leading-[1.6] text-text-2">“{verseText(ctx, id)}”</blockquote>
      {note && <p className="mt-1.5 text-[14px] leading-[1.6] text-text">{note}</p>}
    </li>
  );
}

function RefChips({ ctx, refs }: { ctx: RagContext; refs: string[] }) {
  const focusLineage = useGita((s) => s.focusLineage);
  const nodes = refs.map((id) => ctx.graphs.nodeById.get(id)).filter((n) => !!n);
  if (!nodes.length) return null;
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-3">References</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {nodes.map((n) => (
          <button key={n.id} className="chip" onClick={() => focusLineage(n.id)} title="Open in Lineage: what leads to it and what follows">
            {n.type === "Verse" ? `BG ${n.ref}` : n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GuidePanel({ entryId, text, saved, onSaved }: { entryId: string; text: string; saved?: GuideRecord; onSaved: (g: GuideRecord) => void }) {
  const status = useGita((s) => s.status);
  const conn = useConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<Offline | null>(null);
  const ctx = status === "ready" ? useGita.getState().ragContext() : null;
  const crisis = detectCrisis(text);

  const run = async () => {
    const c = useGita.getState().ragContext();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    setOffline(null);
    try {
      // Meaning-based search (a small model in the browser) alongside keywords, as Ask does; keywords alone if unavailable.
      const query = expandForSearch(text);
      const vector = useSettings.getState().semantic && c.index?.hasVectors ? await embedQuery(query).catch(() => null) : null;
      const r = await retrieve(c, query, { vector, limitVerses: 8 });
      const themes = guideThemes(c, r, text);
      const toOffline = (note: string) =>
        setOffline({
          verses: r.verses.slice(0, 3).map((v) => v.id),
          refs: [...r.verses.slice(0, 3).map((v) => v.id), ...themes],
          note,
        });
      const connection = currentConnection(useSettings.getState());
      if (!connection) return toOffline("These verses were found from the Gita's own connections. Connect an AI model in Settings (gear icon) to get the guide's reflection and a step for tomorrow.");
      const res = await streamFromApi({ mode: "guide", question: text, context: guideContext(c, r, themes) });
      if (!res.ok || !res.text.trim()) return toOffline(`The AI could not be reached (${res.error || "empty reply"}). These verses were found from the Gita's own connections instead.`);
      const parsed = parseGuide(res.text, (id) => c.versesById.has(id));
      const record = { via: `${res.provider || PROVIDERS[connection.provider].name}, ${res.model || connection.model}`, text: res.text.trim(), refs: [...parsed.verses.map((v) => v.id), ...themes] };
      const put = await fetch(`/api/journal/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guide: record }) });
      const data = (await put.json().catch(() => ({}))) as { entry?: { guide?: GuideRecord }; error?: string };
      if (!put.ok || !data.entry?.guide) {
        onSaved({ ...record, at: new Date().toISOString() });
        setError(`Shown, but not saved: ${data.error || `HTTP ${put.status}`}`);
      } else onSaved(data.entry.guide);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const parsed = saved && ctx ? parseGuide(saved.text, (id) => ctx.versesById.has(id)) : null;
  const showing = !!(saved || offline);

  return (
    <div className="mt-3 border-t border-line pt-3">
      {!showing && (
        <button className="btn btn-sm" onClick={run} disabled={busy || status !== "ready"} title={status !== "ready" ? "The Gita is still loading" : undefined}>
          <Sparkles size={14} /> {busy ? "The guide is reading…" : status !== "ready" ? "Loading the Gita…" : "Sit with the guide"}
        </button>
      )}

      {showing && ctx && (
        <div className="space-y-4">
          {crisis && <CrisisNotice />}

          {saved && parsed && !parsed.ok && (
            <div>
              <p className="text-[12.5px] text-text-3">The guide did not reply in the usual shape. Here is the reply as written:</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.6] text-text">{saved.text}</p>
            </div>
          )}

          {saved && parsed?.ok && (
            <>
              {parsed.mirror && <p className="serif text-[16px] italic leading-[1.6] text-text">{parsed.mirror}</p>}
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-3">What the Gita says</div>
                <ul className="mt-2 space-y-3">
                  {parsed.verses.map((v) => (
                    <VerseBlock key={v.id} ctx={ctx} id={v.id} note={v.note} />
                  ))}
                </ul>
              </div>
              <RefChips ctx={ctx} refs={saved.refs} />
              {parsed.action && (
                <div className="rounded-[var(--radius-2)] bg-surface-2 p-3">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-3">One thing for tomorrow</div>
                  <p className="mt-1 text-[14px] leading-[1.6] text-text">{parsed.action}</p>
                </div>
              )}
              <StoryPart ctx={ctx} entryId={entryId} text={text} reply={parsed} story={saved.story} onSaved={(story) => onSaved({ ...saved, story })} />
            </>
          )}

          {!saved && offline && (
            <>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-3">What the Gita says</div>
                <ul className="mt-2 space-y-3">
                  {offline.verses.map((id) => (
                    <VerseBlock key={id} ctx={ctx} id={id} note="" />
                  ))}
                </ul>
              </div>
              <RefChips ctx={ctx} refs={offline.refs} />
              <p className="text-[12.5px] leading-5 text-text-3">{offline.note}</p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-text-3">{saved ? `${saved.via} · ${new Date(saved.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : conn ? "" : "No AI connected"}</span>
            <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy || status !== "ready"}>
              <RotateCw size={13} /> {busy ? "Reading…" : "Ask again"}
            </button>
          </div>
        </div>
      )}
      {showing && !ctx && <p className="text-[13px] text-text-3">Loading the Gita…</p>}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
