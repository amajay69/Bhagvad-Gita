// The guide's input: only what it needs, so it cannot mix verses up. Each verse carries just its plain meaning,
// set apart from its neighbours; a troubling state of mind is included only when the writer stated it themselves.
import type { GraphNode } from "@/lib/types";
import type { RagContext, Retrieval } from "@/lib/graphrag/engine";
import { classifyMention } from "@/lib/graphrag/mentions";
import { fold } from "@/lib/graphrag/text";
import { HINGLISH_CUES } from "./hinglish";

/** True when the writer stated this feeling as their own ("I feel anxious", "mujhe gussa aaya"). */
export function statedByWriter(text: string, node: GraphNode): boolean {
  if (node.type !== "Emotion") return false;
  const t = fold(text);
  return [...node.lexicon, ...(HINGLISH_CUES[node.id] || [])].some((cue) => classifyMention(t, fold(cue)) === "expressed");
}

/** Themes worth showing and sending: healing states always; troubling ones only when the writer stated them. */
export function guideThemes(ctx: RagContext, r: Retrieval, text: string): string[] {
  const emotions = r.emotions
    .map((e) => ctx.graphs.nodeById.get(e.id))
    .filter((n): n is GraphNode => n?.type === "Emotion" && (n.valence === "healing" || statedByWriter(text, n)))
    .slice(0, 2)
    .map((n) => n.id);
  return [...emotions, ...r.dilemmas.slice(0, 1).map((d) => d.id), ...r.concepts.slice(0, 2).map((c) => c.id)];
}

export function guideContext(ctx: RagContext, r: Retrieval, themes: string[], maxVerses = 6): string {
  const def = String(ctx.versesDoc.meta.defaults.en);
  const out: string[] = ["# Verses you may use. Cite as [BG c.v]. Each verse's note must say only what its own Meaning says."];
  for (const v of r.verses.slice(0, maxVerses)) {
    const verse = ctx.versesById.get(v.id);
    if (!verse) continue;
    const meaning = (verse.translations.en?.[def] || Object.values(verse.translations.en || {})[0] || "").replace(/\s+/g, " ").trim();
    out.push(`\n[BG ${verse.ref}]\nMeaning: ${meaning}`);
  }
  const lines: string[] = [];
  for (const id of themes) {
    const n = ctx.graphs.nodeById.get(id);
    if (n?.type === "LifeDilemma") lines.push(`- Life situation: ${n.label}. ${n.desc}`);
    else if (n?.type === "Emotion") lines.push(`- State of mind: ${n.label} (${n.en}). ${n.desc}`);
    else if (n?.type === "SanskritConcept") lines.push(`- Idea: ${n.label} (${n.en}).`);
  }
  if (lines.length) out.push(`\n# Themes the entry may touch (background only; never tell the person they feel these)\n${lines.join("\n")}`);
  return out.join("\n");
}
