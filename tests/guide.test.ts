// Gita Manan guide: replies are laid out in layers, and only verses that exist are ever shown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGuide } from "../src/lib/guide/parse.ts";
import { detectCrisis } from "../src/lib/graphrag/safety.ts";

const real = new Set(["BG_3.35", "BG_2.47", "BG_2.63"]);
const exists = (id: string) => real.has(id);

test("a well-formed reply becomes mirror, verses and one action", () => {
  const r = parseGuide(
    `MIRROR: You keep saying yes to work that isn't yours, and it leaves you feeling small.
GITA:
- [BG 3.35] Doing your own duty, even imperfectly, is better than doing someone else's well.
- [BG 2.47] Focus on your effort, not on how others judge it.
TOMORROW: Before saying yes, pause and ask, "Is this mine to do?"`,
    exists,
  );
  assert.equal(r.ok, true);
  assert.match(r.mirror, /^You keep saying yes/);
  assert.deepEqual(r.verses.map((v) => v.id), ["BG_3.35", "BG_2.47"]);
  assert.match(r.verses[0].note, /own duty/);
  assert.match(r.action, /Is this mine to do/);
});

test("bold labels, numbered bullets and wrapped lines are understood", () => {
  const r = parseGuide(
    `**MIRROR:** Work keeps you late and home feels far away.

**GITA:**
1. **BG 2.47** – Your right is to the work,
   not to its results.
2. [BG 2.63]: Anger clouds judgement.

**TOMORROW:** Leave ten minutes early once.`,
    exists,
  );
  assert.deepEqual(r.verses.map((v) => v.ref), ["2.47", "2.63"]);
  assert.equal(r.verses[0].note, "Your right is to the work, not to its results.");
  assert.equal(r.action, "Leave ten minutes early once.");
});

test("an invented or repeated verse is dropped", () => {
  const r = parseGuide("MIRROR: x\nGITA:\n- [BG 19.99] Made up.\n- [BG 2.47] Real.\n- [BG 2.47] Again.\nTOMORROW: y", exists);
  assert.deepEqual(r.verses.map((v) => v.id), ["BG_2.47"]);
});

test("a reply without the expected shape is flagged, not silently shown as layers", () => {
  assert.equal(parseGuide("I hear you. Take care of yourself.", exists).ok, false);
});

test("crisis language in Hinglish is recognised, not only English and Devanagari", () => {
  assert.equal(detectCrisis("Kabhi kabhi lagta hai marna chahta hoon"), true);
  assert.equal(detectCrisis("ab jeena nahi chahti"), true);
  assert.equal(detectCrisis("khud ko khatam kar dunga"), true);
  assert.equal(detectCrisis("Deadline ne aaj maar diya, bahut thak gaya"), false);
});

test("Hinglish and Indian English feelings are recognised for search", async () => {
  const { hinglishStates, expandForSearch } = await import("../src/lib/guide/hinglish.ts");
  assert.deepEqual(hinglishStates("Mujhe bahut gussa aaya aaj boss pe. Tension ho rahi hai."), ["emotion:krodha", "emotion:chinta"]);
  assert.deepEqual(hinglishStates("feeling too good today"), ["emotion:sukha"]);
  assert.match(expandForSearch("feeling too good"), /happy joy/);
  // a word inside another word does not count ("darshan" is not "dar")
  assert.deepEqual(hinglishStates("went for darshan"), []);
});

test("a feeling stated in Hinglish counts as the writer's own", async () => {
  const { classifyMention } = await import("../src/lib/graphrag/mentions.ts");
  assert.equal(classifyMention("mujhe bahut gussa aaya aaj", "gussa"), "expressed");
});
