import { median, smooth } from "./pitch";
import type { PitchSample } from "./evaluate-tones";

export type CalibrationMethod = "english" | "melody" | "auto";

export type CalibrationProfile = {
  method: CalibrationMethod;
  /** Detected Hz bands. Null for the "auto" (relative) method. */
  lowHz: number | null;
  midHz: number | null;
  highHz: number | null;
  capturedAt: number;
};

export const METHODS: Record<
  CalibrationMethod,
  {
    title: string;
    subtitle: string;
    prompt?: string;
    steps: string[];
    seconds: number;
  }
> = {
  english: {
    title: "English phrases",
    subtitle: "Uses your natural statement and question cadence",
    prompt: "I am practicing my tones. Are you ready?",
    steps: [
      "Say the first sentence normally — that flat clause gives your Mid tone.",
      "Let it fall naturally at the full stop — that drop gives your Low tone.",
      "Then ask “Are you ready?” as a real question — the rise gives your High tone.",
    ],
    seconds: 6,
  },
  melody: {
    title: "Melody / singing",
    subtitle: "Twinkle, Twinkle spans 9 semitones — an ideal range",
    prompt: "Twinkle, twinkle, little star, how I wonder what you are",
    steps: [
      "Play the guide notes, then sing or hum the line in a comfortable key.",
      "The starting note sets your root (Low), the leap sets your High.",
      "Your Mid band is placed between them.",
    ],
    seconds: 9,
  },
  auto: {
    title: "Auto / relative",
    subtitle: "No calibration — each attempt is judged against itself",
    steps: [
      "Every recording is normalised to its own average pitch.",
      "Works instantly, but is less reliable for all-low or all-high words.",
    ],
    seconds: 0,
  },
};

const KEY = "yoruba-tone-calibration-v1";
const STORE_KEY = "yoruba-tone-calibration-v2";

export const AUTO_PROFILE: CalibrationProfile = {
  method: "auto",
  lowHz: null,
  midHz: null,
  highHz: null,
  capturedAt: 0,
};

/** Every method keeps its own saved profile so they never overwrite each other. */
export type CalibrationStore = {
  active: CalibrationMethod;
  profiles: {
    english: CalibrationProfile | null;
    melody: CalibrationProfile | null;
  };
};

export const EMPTY_STORE: CalibrationStore = {
  active: "auto",
  profiles: { english: null, melody: null },
};

export function loadStore(): CalibrationStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CalibrationStore;
      if (parsed?.active && parsed.profiles) {
        return {
          active: parsed.active,
          profiles: {
            english: parsed.profiles.english ?? null,
            melody: parsed.profiles.melody ?? null,
          },
        };
      }
    }
    // Migrate the old single-profile format.
    const legacy = window.localStorage.getItem(KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as CalibrationProfile;
      if (p?.method) {
        const store: CalibrationStore = {
          active: p.method,
          profiles: {
            english: p.method === "english" ? p : null,
            melody: p.method === "melody" ? p : null,
          },
        };
        saveStore(store);
        return store;
      }
    }
    return EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(store: CalibrationStore) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable — profiles stay in memory only */
  }
}

/** The profile currently applied to practice scoring. */
export function activeProfile(store: CalibrationStore): CalibrationProfile {
  if (store.active === "auto") return AUTO_PROFILE;
  return store.profiles[store.active] ?? AUTO_PROFILE;
}

export function withSavedProfile(store: CalibrationStore, profile: CalibrationProfile): CalibrationStore {
  if (profile.method === "auto") return { ...store, active: "auto" };
  return {
    active: profile.method,
    profiles: { ...store.profiles, [profile.method]: profile },
  };
}

export function clearProfile() {
  try {
    window.localStorage.removeItem(STORE_KEY);
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i]!;
}

export type CalibrationResult =
  | { ok: true; profile: CalibrationProfile; spreadSemitones: number; voicedFrames: number }
  | { ok: false; message: string };

/** Derive Low/Mid/High Hz bands from a calibration recording. */
export function analyseCalibration(samples: PitchSample[], method: CalibrationMethod): CalibrationResult {
  if (method === "auto") {
    return { ok: true, profile: { ...AUTO_PROFILE, capturedAt: Date.now() }, spreadSemitones: 0, voicedFrames: 0 };
  }

  const voiced = samples.filter((s) => s.hz > 0);
  if (voiced.length < 20) {
    return { ok: false, message: "Not enough voice detected. Speak or sing a bit louder, closer to the mic." };
  }

  const hz = smooth(
    voiced.map((s) => s.hz),
    7,
  );
  const sorted = [...hz].sort((a, b) => a - b);
  const low = percentile(sorted, 0.08);
  const high = percentile(sorted, 0.92);
  const spread = 12 * Math.log2(high / low);

  if (spread < 2) {
    return {
      ok: false,
      message: "Your pitch barely moved. Try again with a clearer fall and rise (or a fuller melody).",
    };
  }

  let lowHz: number;
  let midHz: number;
  let highHz: number;

  if (method === "english") {
    // Mid comes from the neutral speaking clause (first ~55% of the phrase).
    const clause = hz.slice(0, Math.max(6, Math.floor(hz.length * 0.55)));
    midHz = median(clause);
    lowHz = low;
    highHz = high;
    // Keep mid sensibly inside the band.
    midHz = Math.min(Math.max(midHz, lowHz * Math.pow(2, 1 / 12)), highHz / Math.pow(2, 1 / 12));
  } else {
    // Melody: root note is the low anchor, the leap is the high anchor, mid sits between.
    lowHz = low;
    highHz = high;
    midHz = Math.sqrt(lowHz * highHz);
  }

  return {
    ok: true,
    profile: {
      method,
      lowHz: Math.round(lowHz * 10) / 10,
      midHz: Math.round(midHz * 10) / 10,
      highHz: Math.round(highHz * 10) / 10,
      capturedAt: Date.now(),
    },
    spreadSemitones: spread,
    voicedFrames: voiced.length,
  };
}

export const isCalibrated = (p: CalibrationProfile) =>
  p.method !== "auto" && !!p.lowHz && !!p.midHz && !!p.highHz;
