// Turns the guide's line-based reply into layers. Tolerant of markdown bold, numbering and stray spacing,
// because smaller models do not always follow the format exactly.

export interface GuideVerse {
  /** graph id, e.g. "BG_3.35" */
  id: string;
  /** display ref, e.g. "3.35" */
  ref: string;
  note: string;
}

export interface GuideReply {
  mirror: string;
  verses: GuideVerse[];
  action: string;
  /** true when the reply had the expected shape (at least one verse) */
  ok: boolean;
}

const clean = (s: string) => s.replace(/\*\*|__/g, "").replace(/^\s*[-*•\d.)]+\s*/, "").trim();
const LABEL = /^\s*(?:[-*#>]\s*)*\**\s*(MIRROR|GITA|TOMORROW)\s*\**\s*:\s*\**\s*(.*)$/i;
const VERSE = /^\s*(?:[-*•]|\d+[.)])?\s*\**\[?\s*BG\s*(\d{1,2})\.(\d{1,2})\s*\]?\**\s*[:\-–—]?\s*(.*)$/i;

/** `exists` keeps only verses present in the verified verse data; a cited verse that does not exist is dropped. */
export function parseGuide(text: string, exists: (id: string) => boolean): GuideReply {
  let mirror = "";
  let action = "";
  const verses: GuideVerse[] = [];
  let section = "" as "" | "mirror" | "gita" | "tomorrow";
  for (const line of text.split(/\r?\n/)) {
    const label = line.match(LABEL);
    if (label) {
      section = label[1].toLowerCase() as typeof section;
      const rest = clean(label[2]);
      if (section === "mirror" && rest) mirror = rest;
      else if (section === "tomorrow" && rest) action = rest;
      else if (section === "gita" && rest) addVerse(rest);
      continue;
    }
    if (!line.trim()) continue;
    if (section === "gita") addVerse(line);
    else if (section === "mirror" && !mirror) mirror = clean(line);
    else if (section === "tomorrow") action = action ? `${action} ${clean(line)}` : clean(line);
  }
  return { mirror, verses, action, ok: verses.length > 0 };

  function addVerse(line: string) {
    const m = line.match(VERSE);
    if (!m) {
      // a continuation of the previous verse's note
      const last = verses[verses.length - 1];
      if (last) last.note = `${last.note} ${clean(line)}`.trim();
      return;
    }
    const id = `BG_${Number(m[1])}.${Number(m[2])}`;
    if (!exists(id) || verses.some((v) => v.id === id)) return;
    verses.push({ id, ref: `${Number(m[1])}.${Number(m[2])}`, note: m[3].replace(/\*\*/g, "").trim() });
  }
}
