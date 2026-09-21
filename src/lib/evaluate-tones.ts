import { median, smooth } from "./pitch";
import type { Tone } from "./tone-deck";

export type PitchSample = { t: number; hz: number };

export type SyllableResult = {
  target: Tone;
  detected: Tone;
  relSemitones: number;
  correct: boolean;
};

export type Evaluation = {
  ok: boolean;
  message?: string;
  score: number;
  baselineHz: number;
  rangeSemitones: number;
  syllables: SyllableResult[];
  contourScore: number;
  tips: string[];
};

function classify(rel: number, spread: number): Tone {
  // Threshold scales with how much range the speaker actually used.
  const thr = Math.max(0.9, Math.min(2.2, spread * 0.35));
  if (rel > thr) return "H";
  if (rel < -thr) return "L";
  return "M";
}

export function evaluateContour(samples: PitchSample[], targets: Tone[]): Evaluation {
  const voiced = samples.filter((s) => s.hz > 0);
  const empty: Evaluation = {
    ok: false,
    score: 0,
    baselineHz: 0,
    rangeSemitones: 0,
    syllables: [],
    contourScore: 0,
    tips: [],
  };

  if (voiced.length < 8) {
    return { ...empty, message: "I couldn't hear a clear voice. Try again a little louder and closer to the mic." };
  }

  const hz = smooth(voiced.map((s) => s.hz), 5);
  const baselineHz = median(hz);
  const st = hz.map((f) => 12 * Math.log2(f / baselineHz));

  // Trim wobbly onset/offset frames
  const trim = Math.floor(st.length * 0.08);
  const core = st.slice(trim, st.length - trim || undefined);
  const series = core.length >= targets.length * 3 ? core : st;

  const spread = Math.max(...series) - Math.min(...series);

  const n = targets.length;
  const per = series.length / n;
  const segMeans: number[] = [];
  for (let i = 0; i < n; i++) {
    const seg = series.slice(Math.floor(i * per), Math.floor((i + 1) * per));
    segMeans.push(median(seg));
  }
  const centre = segMeans.reduce((a, b) => a + b, 0) / n;

  const allSame = targets.every((t) => t === targets[0]);

  const syllables: SyllableResult[] = targets.map((target, i) => {
    const rel = segMeans[i] - centre;
    let detected: Tone;
    if (allSame) {
      // A level word: judge absolute placement against the utterance baseline.
      detected = spread < 2.2 ? targets[0] : classify(segMeans[i], spread);
    } else {
      detected = classify(rel, spread);
    }
    return { target, detected, relSemitones: rel, correct: detected === target };
  });

  // Contour: do the shifts between syllables move the right way?
  let contourHits = 0;
  let contourTotal = 0;
  for (let i = 1; i < n; i++) {
    contourTotal++;
    const targetDelta = toneValue(targets[i]) - toneValue(targets[i - 1]);
    const actualDelta = segMeans[i] - segMeans[i - 1];
    if (targetDelta === 0 ? Math.abs(actualDelta) < 1.6 : Math.sign(actualDelta) === Math.sign(targetDelta) && Math.abs(actualDelta) > 0.8) {
      contourHits++;
    }
  }
  const contourScore = contourTotal ? contourHits / contourTotal : syllables[0].correct ? 1 : 0;
  const syllScore = syllables.filter((s) => s.correct).length / n;
  const score = Math.round((syllScore * 0.7 + contourScore * 0.3) * 100);

  const tips: string[] = [];
  syllables.forEach((s, i) => {
    if (s.correct) return;
    const pos = `syllable ${i + 1}`;
    if (s.target === "H" && s.detected !== "H") tips.push(`Lift ${pos} higher — it should sit clearly above your speaking pitch.`);
    if (s.target === "L" && s.detected !== "L") tips.push(`Drop ${pos} lower — low tone falls below your speaking pitch.`);
    if (s.target === "M" && s.detected === "H") tips.push(`Keep ${pos} level — you rose where the tone should stay flat.`);
    if (s.target === "M" && s.detected === "L") tips.push(`Keep ${pos} level — you dipped where the tone should stay flat.`);
  });
  if (!allSame && spread < 1.5) tips.push("Your pitch stayed almost flat. Exaggerate the movement at first, then relax it.");
  if (spread > 14) tips.push("Your pitch jumped a lot — try smaller, steadier steps so the tones stay distinct but natural.");
  if (!tips.length) tips.push("Clean contour. Try saying it faster while keeping the same tone shape.");

  return {
    ok: true,
    score,
    baselineHz,
    rangeSemitones: spread,
    syllables,
    contourScore,
    tips: tips.slice(0, 3),
  };
}

const toneValue = (t: Tone) => (t === "H" ? 1 : t === "M" ? 0 : -1);
