export type Tone = "H" | "M" | "L";

export type ToneWord = {
  id: string;
  word: string;
  syllables: string[];
  tones: Tone[];
  meaning: string;
  gloss: string;
  group: string;
};

export const TONE_INFO: Record<Tone, { label: string; mark: string; solfa: string; semitone: number }> = {
  H: { label: "High", mark: "Ó", solfa: "Do", semitone: 4 },
  M: { label: "Mid", mark: "O", solfa: "Re", semitone: 0 },
  L: { label: "Low", mark: "Ò", solfa: "Mi", semitone: -4 },
};

export const DECK: ToneWord[] = [
  {
    id: "owo-money",
    word: "owó",
    syllables: ["o", "wó"],
    tones: ["M", "H"],
    meaning: "money",
    gloss: "Mid then High — step up on the second syllable.",
    group: "owó / ọ̀wọ̀ / òwò",
  },
  {
    id: "owo-respect",
    word: "ọ̀wọ̀",
    syllables: ["ọ̀", "wọ̀"],
    tones: ["L", "L"],
    meaning: "respect / honour",
    gloss: "Two low tones — stay low and level, below your speaking pitch.",
    group: "owó / ọ̀wọ̀ / òwò",
  },
  {
    id: "owo-trade",
    word: "òwò",
    syllables: ["ò", "wò"],
    tones: ["L", "L"],
    meaning: "trade / business",
    gloss: "Also two low tones — the vowels differ, not the melody.",
    group: "owó / ọ̀wọ̀ / òwò",
  },
  {
    id: "baba-father",
    word: "bàbá",
    syllables: ["bà", "bá"],
    tones: ["L", "H"],
    meaning: "father",
    gloss: "Low then High — a clear rise, the widest jump in the deck.",
    group: "bàbá / baba",
  },
  {
    id: "baba-elder",
    word: "baba",
    syllables: ["ba", "ba"],
    tones: ["M", "M"],
    meaning: "elder / master",
    gloss: "Flat mid tone throughout — resist any rise or fall.",
    group: "bàbá / baba",
  },
  {
    id: "ile-house",
    word: "ilé",
    syllables: ["i", "lé"],
    tones: ["M", "H"],
    meaning: "house",
    gloss: "Mid then High — lift the last syllable.",
    group: "ilé / ilẹ̀",
  },
  {
    id: "ile-land",
    word: "ilẹ̀",
    syllables: ["i", "lẹ̀"],
    tones: ["M", "L"],
    meaning: "land / ground",
    gloss: "Mid then Low — drop the last syllable instead.",
    group: "ilé / ilẹ̀",
  },
  {
    id: "oko-farm",
    word: "oko",
    syllables: ["o", "ko"],
    tones: ["M", "M"],
    meaning: "farm",
    gloss: "Level mid tones.",
    group: "oko / ọkọ̀ / ọkọ",
  },
  {
    id: "oko-vehicle",
    word: "ọkọ̀",
    syllables: ["ọ", "kọ̀"],
    tones: ["M", "L"],
    meaning: "vehicle",
    gloss: "Mid then Low.",
    group: "oko / ọkọ̀ / ọkọ",
  },
  {
    id: "oko-husband",
    word: "ọkọ",
    syllables: ["ọ", "kọ"],
    tones: ["M", "M"],
    meaning: "husband",
    gloss: "Level mid tones, different vowels from oko (farm).",
    group: "oko / ọkọ̀ / ọkọ",
  },
  {
    id: "igba-time",
    word: "ìgbà",
    syllables: ["ì", "gbà"],
    tones: ["L", "L"],
    meaning: "time / season",
    gloss: "Two low tones.",
    group: "ìgbà / igbá",
  },
  {
    id: "igba-calabash",
    word: "igbá",
    syllables: ["i", "gbá"],
    tones: ["M", "H"],
    meaning: "calabash",
    gloss: "Mid then High.",
    group: "ìgbà / igbá",
  },
  {
    id: "ori-head",
    word: "orí",
    syllables: ["o", "rí"],
    tones: ["M", "H"],
    meaning: "head",
    gloss: "Mid then High.",
    group: "orí / òrí",
  },
  {
    id: "ori-shea",
    word: "òrí",
    syllables: ["ò", "rí"],
    tones: ["L", "H"],
    meaning: "shea butter",
    gloss: "Low then High — start clearly under your baseline.",
    group: "orí / òrí",
  },
  {
    id: "omo-child",
    word: "ọmọ",
    syllables: ["ọ", "mọ"],
    tones: ["M", "M"],
    meaning: "child",
    gloss: "Level mid tones.",
    group: "ọmọ",
  },
  {
    id: "eko-lagos",
    word: "Èkó",
    syllables: ["è", "kó"],
    tones: ["L", "H"],
    meaning: "Lagos",
    gloss: "Low then High.",
    group: "Èkó",
  },
];
