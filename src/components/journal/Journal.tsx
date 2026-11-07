"use client";
// Gita Manan: the journal. Write what is on your mind; entries are saved as files on this computer.
import { useCallback, useEffect, useState } from "react";
import { Check, FolderOpen, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { GuidePanel, type GuideRecord } from "./Guide";

interface Entry {
  id: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  guide?: GuideRecord;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function EntryCard({ entry, onSaved, onDeleted }: { entry: Entry; onSaved: (e: Entry) => void; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { entry: next } = await call<{ entry: Entry }>(`/api/journal/${entry.id}`, { method: "PUT", body: JSON.stringify({ text: draft }) });
      onSaved(next);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Move this entry to the trash folder? It is not erased and can be recovered from the folder.")) return;
    setBusy(true);
    setError(null);
    try {
      await call(`/api/journal/${entry.id}`, { method: "DELETE" });
      onDeleted(entry.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <li className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] text-text-3">
          {timeLabel(entry.createdAt)}
          {entry.updatedAt !== entry.createdAt && <span> · edited</span>}
        </div>
        {!editing && (
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => (setDraft(entry.text), setEditing(true))} disabled={busy} aria-label="Edit entry">
              <Pencil size={14} /> Edit
            </button>
            <button className="btn btn-ghost btn-sm" onClick={remove} disabled={busy} aria-label="Delete entry">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="field serif mt-2 min-h-[140px] w-full text-[16px] leading-[1.6]" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit entry" />
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !draft.trim()}>
              <Check size={14} /> Save
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
              <X size={14} /> Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="serif mt-2 whitespace-pre-wrap text-[16px] leading-[1.65] text-text">{entry.text}</p>
          <GuidePanel entryId={entry.id} text={entry.text} saved={entry.guide} onSaved={(guide) => onSaved({ ...entry, guide })} />
        </>
      )}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </li>
  );
}

export default function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folder, setFolder] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call<{ folder: string; entries: Entry[] }>("/api/journal");
      setEntries(data.entries);
      setFolder(data.folder);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const { entry } = await call<{ entry: Entry }>("/api/journal", { method: "POST", body: JSON.stringify({ text }) });
      setEntries((list) => [entry, ...list]);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Group entries by day, newest day first.
  const days: { day: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const day = dayLabel(e.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(e);
    else days.push({ day, items: [e] });
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">What is on your mind today?</h1>
        <p className="mt-1 text-[13.5px] text-text-3">{dayLabel(new Date().toISOString())}</p>

        {status === "error" ? (
          <div className="panel mt-6 p-4" role="alert">
            <div className="flex items-center gap-2 text-danger">
              <TriangleAlert size={16} />
              <span className="text-[14px] font-semibold">The journal could not be opened</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-5 text-text-2">{error}</p>
          </div>
        ) : (
          <>
            <div className="panel mt-6 p-1">
              <textarea
                className="serif block min-h-[180px] w-full resize-y bg-transparent px-4 py-3 text-[17px] leading-[1.65] text-text outline-none placeholder:text-text-3"
                placeholder="Write freely: what happened, what you felt, what is worrying you. Hindi, English or both."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim() && !saving) add();
                }}
                aria-label="Today's journal entry"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[12px] text-text-3">Ctrl + Enter to save</span>
              <button className="btn btn-primary" onClick={add} disabled={saving || !text.trim()}>
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
            {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

            {status === "loading" && <div className="progress-indeterminate mt-8" role="status" aria-label="Loading entries" />}
            {status === "ready" && entries.length === 0 && <p className="mt-10 text-center text-[14px] text-text-3">Your entries will appear here.</p>}

            {days.map((d) => (
              <section key={d.day} className="mt-8">
                <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-text-3">{d.day}</h2>
                <ul className="space-y-3">
                  {d.items.map((e) => (
                    <EntryCard
                      key={e.id}
                      entry={e}
                      onSaved={(next) => setEntries((list) => list.map((x) => (x.id === next.id ? next : x)))}
                      onDeleted={(id) => setEntries((list) => list.filter((x) => x.id !== id))}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {folder && (
              <p className="mt-10 flex items-start gap-2 text-[12px] leading-5 text-text-3">
                <FolderOpen size={14} className="mt-0.5 shrink-0" />
                <span>
                  Saved privately on this computer in <code className="break-all text-text-2">{folder}</code>
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
