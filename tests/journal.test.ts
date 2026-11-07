// Gita Manan journal: entries are files on this computer, saved safely, never erased, and private to this machine.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEntry, documentsDir, isEntryId, journalDir, listEntries, saveGuide, trashEntry, updateEntry } from "../src/lib/server/journal.ts";
import { isLocalRequest } from "../src/lib/server/guard.ts";

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), "gita-manan-"));

test("an entry is saved as a file and listed newest first", async () => {
  const dir = await tmpDir();
  const a = await createEntry("  Aaj office mein bahut pressure tha.  ", dir, new Date("2026-11-01T09:00:00Z"));
  const b = await createEntry("Felt calmer today.", dir, new Date("2026-11-02T09:00:00Z"));
  assert.equal(a.text, "Aaj office mein bahut pressure tha.");
  assert.ok(isEntryId(a.id));
  const onDisk = JSON.parse(await fs.readFile(path.join(dir, `${a.id}.json`), "utf8"));
  assert.equal(onDisk.text, a.text);
  assert.deepEqual((await listEntries(dir)).map((e) => e.id), [b.id, a.id]);
  // no temporary files are left behind
  assert.deepEqual((await fs.readdir(dir)).filter((n) => n.endsWith(".tmp")), []);
});

test("editing keeps the creation date and records the edit time", async () => {
  const dir = await tmpDir();
  const e = await createEntry("first wording", dir, new Date("2026-11-01T09:00:00Z"));
  const next = await updateEntry(e.id, "second wording", dir, new Date("2026-11-03T09:00:00Z"));
  assert.equal(next.createdAt, e.createdAt);
  assert.equal(next.updatedAt, "2026-11-03T09:00:00.000Z");
  assert.equal((await listEntries(dir))[0].text, "second wording");
});

test("deleting moves the entry to the trash folder instead of erasing it", async () => {
  const dir = await tmpDir();
  const e = await createEntry("to be removed", dir);
  await trashEntry(e.id, dir);
  assert.deepEqual(await listEntries(dir), []);
  assert.ok(await fs.stat(path.join(dir, "trash", `${e.id}.json`)));
});

test("empty entries and ids that point outside the folder are refused", async () => {
  const dir = await tmpDir();
  await assert.rejects(createEntry("   ", dir), /empty/);
  await assert.rejects(createEntry(42, dir), /text/);
  await assert.rejects(updateEntry("../../secret", "x", dir), /Unknown entry/);
  await assert.rejects(trashEntry("..\\..\\secret", dir), /Unknown entry/);
});

test("a missing folder means no entries yet, and unreadable files are skipped, not deleted", async () => {
  const dir = await tmpDir();
  assert.deepEqual(await listEntries(path.join(dir, "not-yet-created")), []);
  const bad = path.join(dir, "20261101-090000-abcdef12.json");
  await fs.writeFile(bad, "{ not json");
  assert.deepEqual(await listEntries(dir), []);
  assert.ok(await fs.stat(bad));
});

test("the journal is served only on this computer, never to other devices on the Wi-Fi", () => {
  const req = (host: string, headers: Record<string, string> = {}) => new Request(`http://${host}/api/journal`, { headers: { host, ...headers } });
  // journalGuard (src/lib/server/journalHttp.ts) refuses every request for which this is false
  assert.equal(isLocalRequest(req("localhost:3000")), true);
  assert.equal(isLocalRequest(req("192.168.29.209:3000")), false);
  assert.equal(isLocalRequest(req("localhost:3000", { origin: "https://evil.example" })), false);
});

test("the diary goes to OneDrive's Documents when OneDrive has taken over Documents", async () => {
  const home = await tmpDir();
  const oneDrive = path.join(home, "OneDrive");
  assert.equal(documentsDir({ OneDrive: oneDrive }, home), path.join(home, "Documents"));
  await fs.mkdir(path.join(oneDrive, "Documents"), { recursive: true });
  assert.equal(documentsDir({ OneDrive: oneDrive }, home), path.join(oneDrive, "Documents"));
  assert.equal(journalDir({ GITA_MANAN_DIR: path.join(home, "mine") }), path.join(home, "mine"));
});

test("the guide's reply is saved with the entry and survives an edit of the entry", async () => {
  const dir = await tmpDir();
  const e = await createEntry("colleague gives me his work", dir);
  await saveGuide(e.id, { via: "Groq, model", text: "MIRROR: x\nGITA:\n- [BG 3.35] y", refs: ["BG_3.35", "emotion:krodha", "../../etc"] }, dir);
  await updateEntry(e.id, "colleague gives me his work, again", dir);
  const [saved] = await listEntries(dir);
  assert.equal(saved.guide?.via, "Groq, model");
  assert.deepEqual(saved.guide?.refs, ["BG_3.35", "emotion:krodha"]);
  await assert.rejects(saveGuide(e.id, { text: "" }, dir), /missing/);
});
