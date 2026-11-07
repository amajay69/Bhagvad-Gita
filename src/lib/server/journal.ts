// Gita Manan journal: one JSON file per entry, in a folder on the user's own computer.
// The folder lives outside the app (default: Documents/Gita Manan/journal) so updating or reinstalling the app
// never touches the diary. Deleted entries move to a "trash" subfolder instead of being erased.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface JournalEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  text: string;
}

export const MAX_ENTRY_CHARS = 20000;

/** Entry ids are generated here; anything else is refused so a request can never reach outside the folder. */
const ID_RE = /^\d{8}-\d{6}-[a-f0-9]{8}$/;
export const isEntryId = (id: string) => ID_RE.test(id);

export function journalDir(): string {
  const custom = process.env.GITA_MANAN_DIR?.trim();
  return custom ? path.resolve(custom) : path.join(os.homedir(), "Documents", "Gita Manan", "journal");
}

const fileFor = (dir: string, id: string) => path.join(dir, `${id}.json`);

function newId(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Write to a temporary file first, then swap it in, so a crash mid-save never leaves a half-written entry. */
async function writeAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  try {
    await fs.rename(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
}

function cleanText(text: unknown): string {
  if (typeof text !== "string") throw new JournalError("The entry must be text.", 400);
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) throw new JournalError("The entry is empty.", 400);
  if (t.length > MAX_ENTRY_CHARS) throw new JournalError(`The entry is longer than ${MAX_ENTRY_CHARS} characters.`, 400);
  return t;
}

export class JournalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function parseEntry(raw: string): JournalEntry | null {
  try {
    const e = JSON.parse(raw) as Partial<JournalEntry>;
    if (typeof e.id !== "string" || !isEntryId(e.id) || typeof e.text !== "string" || typeof e.createdAt !== "string") return null;
    return { id: e.id, text: e.text, createdAt: e.createdAt, updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : e.createdAt };
  } catch {
    return null;
  }
}

/** All entries, newest first. Unreadable files are skipped, never deleted. */
export async function listEntries(dir = journalDir()): Promise<JournalEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const entries: JournalEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || !isEntryId(name.slice(0, -5))) continue;
    try {
      const entry = parseEntry(await fs.readFile(path.join(dir, name), "utf8"));
      if (entry) entries.push(entry);
    } catch {}
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createEntry(text: unknown, dir = journalDir(), now = new Date()): Promise<JournalEntry> {
  const clean = cleanText(text);
  await fs.mkdir(dir, { recursive: true });
  const at = now.toISOString();
  const entry: JournalEntry = { id: newId(now), createdAt: at, updatedAt: at, text: clean };
  await writeAtomic(fileFor(dir, entry.id), JSON.stringify(entry, null, 2));
  return entry;
}

async function readEntry(dir: string, id: string): Promise<JournalEntry> {
  if (!isEntryId(id)) throw new JournalError("Unknown entry.", 404);
  let raw: string;
  try {
    raw = await fs.readFile(fileFor(dir, id), "utf8");
  } catch {
    throw new JournalError("Unknown entry.", 404);
  }
  const entry = parseEntry(raw);
  if (!entry) throw new JournalError("This entry's file could not be read.", 500);
  return entry;
}

export async function updateEntry(id: string, text: unknown, dir = journalDir(), now = new Date()): Promise<JournalEntry> {
  const entry = await readEntry(dir, id);
  const next: JournalEntry = { ...entry, text: cleanText(text), updatedAt: now.toISOString() };
  await writeAtomic(fileFor(dir, id), JSON.stringify(next, null, 2));
  return next;
}

/** Moves the entry into the "trash" subfolder; nothing is erased. */
export async function trashEntry(id: string, dir = journalDir()): Promise<void> {
  await readEntry(dir, id);
  const trash = path.join(dir, "trash");
  await fs.mkdir(trash, { recursive: true });
  await fs.rename(fileFor(dir, id), fileFor(trash, id));
}
