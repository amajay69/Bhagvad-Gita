// How people in India actually write their feelings: Hinglish and Indian English words, mapped to the graph's
// states of mind. Used to find verses (by adding English words to the search) and to recognise a feeling the writer
// stated ("mujhe gussa aaya"). No imports, so it runs under `node --test`.

/** state of mind id → words a writer in India may use for it (Roman script) */
export const HINGLISH_CUES: Record<string, string[]> = {
  "emotion:krodha": ["gussa", "naraz", "naaraz", "chidh", "chid", "khunnas"],
  "emotion:bhaya": ["dar", "darr", "ghabrahat", "ghabra", "ghabraya", "ghabrayi", "dara hua", "dari hui"],
  "emotion:chinta": ["tension", "chinta", "fikar", "fikr", "pareshan", "pareshaan", "stress"],
  "emotion:vishada": ["udaas", "udas", "nirash", "niraash", "low feel", "feeling low", "dil nahi lag"],
  "emotion:shoka": ["dukh", "dukhi", "rona aa", "ro raha", "ro rahi"],
  "emotion:klaibya": ["thak gaya", "thak gayi", "haar gaya", "haar gayi", "himmat nahi"],
  "emotion:pramada": ["thakaan", "aalas", "aalsi", "neend", "mann nahi kar"],
  "emotion:moha": ["confuse", "samajh nahi", "kya karu", "kya karoon", "kya karun"],
  "emotion:samshaya": ["doubt", "having doubt", "pakka nahi"],
  "emotion:dvesha": ["nafrat", "chidh", "bardasht nahi"],
  "emotion:ahamkara": ["ghamand", "akad", "attitude"],
  "emotion:sanga": ["moh", "chhod nahi"],
  "emotion:sukha": ["khush", "khushi", "good", "great", "acha", "achha", "accha", "mazaa", "maza", "badhiya", "awesome"],
  "emotion:santosha": ["shukar", "shukriya", "santusht", "blessed", "thankful"],
  "emotion:shanti": ["sukoon", "shant", "shanti", "relaxed", "halka"],
};

/** English words added to the search for each state, so Hinglish entries find the same verses English ones do. */
const ENGLISH: Record<string, string> = {
  "emotion:krodha": "angry anger",
  "emotion:bhaya": "afraid fear anxious",
  "emotion:chinta": "worried stress",
  "emotion:vishada": "sad depressed hopeless",
  "emotion:shoka": "grief sorrow",
  "emotion:klaibya": "overwhelmed weak",
  "emotion:pramada": "tired lethargic",
  "emotion:moha": "confused",
  "emotion:samshaya": "doubt unsure",
  "emotion:dvesha": "hate resent",
  "emotion:ahamkara": "ego pride",
  "emotion:sanga": "attachment",
  "emotion:sukha": "happy joy",
  "emotion:santosha": "grateful content",
  "emotion:shanti": "peace calm",
};

const fold = (s: string) => s.toLowerCase().replace(/[’'`]/g, "");
/** whole words only: "dar" (fear) must not match "darshan" */
const has = (text: string, cue: string) => new RegExp(`(^|[^a-z])${cue.replace(/ /g, "\\s+")}([^a-z]|$)`, "i").test(text);

/** States of mind whose Hinglish or Indian English words appear in the text. */
export function hinglishStates(text: string): string[] {
  const t = fold(text);
  return Object.entries(HINGLISH_CUES)
    .filter(([, cues]) => cues.some((c) => has(t, c)))
    .map(([id]) => id);
}

/** The text plus English words for the states it names, for searching. */
export function expandForSearch(text: string): string {
  const extra = hinglishStates(text).map((id) => ENGLISH[id]).filter(Boolean);
  return extra.length ? `${text}\n${extra.join(" ")}` : text;
}
