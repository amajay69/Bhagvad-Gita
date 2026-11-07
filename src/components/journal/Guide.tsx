"use client";
// "Sit with the guide": what the Gita says about one journal entry, in layers.
// Verse wording always comes from the verified verse data; the model only explains how a verse speaks to the entry.
import { useState } from "react";
import { HeartHandshake, RotateCw, Sparkles } from "lucide-react";
import { useGita } from "@/lib/store/useGitaStore";
import { currentConnection, useConnection, useSettings } from "@/lib/store/settingsStore";
import { PROVIDERS } from "@/lib/llm/providers";
import { streamFromApi } from "@/lib/llm/browser";
import { retrieve, type RagContext } from "@/lib/graphrag/engine";
import { CRISIS_RESOURCES, detectCrisis } from "@/lib/graphrag/safety";
import { parseGuide } from "@/lib/guide/parse";
import { embedQuery } from "@/lib/graphrag/search";

export interface GuideRecord {
  at: string;
  via: string;
  text: string;
  refs: string[];
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
      const vector = useSettings.getState().semantic && c.index?.hasVectors ? await embedQuery(text).catch(() => null) : null;
      const r = await retrieve(c, text, { vector, limitVerses: 8 });
      const themes = [...r.emotions.slice(0, 2), ...r.dilemmas.slice(0, 1), ...r.concepts.slice(0, 2)].map((x) => x.id);
      const toOffline = (note: string) =>
        setOffline({
          verses: r.verses.slice(0, 3).map((v) => v.id),
          refs: [...r.verses.slice(0, 3).map((v) => v.id), ...themes],
          note,
        });
      const connection = currentConnection(useSettings.getState());
      if (!connection) return toOffline("These verses were found from the Gita's own connections. Connect an AI model in Settings (gear icon) to get the guide's reflection and a step for tomorrow.");
      const res = await streamFromApi({ mode: "guide", question: text, context: r.context });
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
