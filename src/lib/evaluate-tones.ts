import { median, smooth } from "./pitch";
import type { CalibrationProfile } from "./calibration";
import type { Tone } from "./tone-deck";

export type PitchSample = { t: number; hz: number };

export type SyllableResult = {
  target: Tone;
  detected: Tone;
  relSemitones: number;
  /** Local movement from the preceding syllable; zero for the starting anchor. */
  deltaSemitones: number;
  /** Absolute pitch of this syllable in Hz. */
  hz: number;
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
  /** True when calibration supplied the speaker's relative step sensitivity. */
  usedCalibration: boolean;
  /** Personalized size of one Low↔Mid or Mid↔High step. */
  stepSemitones: number;
};

const toneValue = (t: Tone) => (t === "H" ? 1 : t === "M" ? 0 : -1);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function calibrationStep(profile?: CalibrationProfile | null) {
  if (!profile?.lowHz || !profile.midHz || !profile.highHz) return null;
  const lowStep = Math.abs(12 * Math.log2(profile.midHz / profile.lowHz));
  const highStep = Math.abs(12 * Math.log2(profile.highHz / profile.midHz));
  return clamp((lowStep + highStep) / 2, 0.8, 6);
}

function inferStep(spread: number) {
  // Without calibration, scale sensitivity gently to the current vocal range.
  // The bounds prevent one performance from defining its own answer.
  return clamp(spread / 3, 1.2, 3.5);
}

function movementLevel(actual: number, step: number) {
  // A little downward movement is still level: connected Yorùbá speech naturally downdrifts.
  if (actual >= -step * 0.6 && actual <= step * 0.45) return 0;
  const magnitude = Math.abs(actual);
  return Math.sign(actual) * (magnitude >= step * 1.5 ? 2 : 1);
}

function transitionMatches(actual: number, targetLevels: number, step: number) {
  return movementLevel(actual, step) === targetLevels;
}

export function evaluateContour(
  samples: PitchSample[],
  targets: Tone[],
  profile?: CalibrationProfile | null,
): Evaluation {
  const voiced = samples.filter((s) => s.hz > 0);
  const empty: Evaluation = {
    ok: false,
    score: 0,
    baselineHz: 0,
    rangeSemitones: 0,
    syllables: [],
    contourScore: 0,
    tips: [],
    usedCalibration: false,
    stepSemitones: 2.5,
  };

  if (voiced.length < 8 || targets.length === 0) {
    return {
      ...empty,
      message: "I couldn't hear a clear voice. Try again a little louder and closer to the mic.",
    };
  }

  const hz = smooth(
    voiced.map((s) => s.hz),
    5,
  );
  const utteranceMedian = median(hz);

  const calibratedStep = calibrationStep(profile);
  const baselineHz = profile?.midHz ?? utteranceMedian;

  const st = hz.map((f) => 12 * Math.log2(f / baselineHz));

  // Trim wobbly onset/offset frames
  const trim = Math.floor(st.length * 0.08);
  const core = st.slice(trim, st.length - trim);
  const series = core.length >= targets.length * 3 ? core : st;

  const spread = Math.max(...series) - Math.min(...series);

  const n = targets.length;
  const per = series.length / n;
  const segMeans: number[] = [];
  for (let i = 0; i < n; i++) {
    const seg = series.slice(Math.floor(i * per), Math.floor((i + 1) * per));
    segMeans.push(median(seg.length ? seg : series));
  }
  const first = targets[0]!;
  const allSame = targets.every((t) => t === first);
  const deltas = segMeans.map((mean, i) => (i === 0 ? 0 : mean - segMeans[i - 1]!));
  const stepSemitones = calibratedStep ?? inferStep(spread);
  let detectedLevel = toneValue(first);

  const syllables: SyllableResult[] = targets.map((target, i) => {
    const mean = segMeans[i]!;
    const delta = deltas[i]!;
    const targetDelta = i === 0 ? 0 : toneValue(target) - toneValue(targets[i - 1]!);
    const correct = i === 0 || transitionMatches(delta, targetDelta, stepSemitones);
    if (i > 0) detectedLevel = clamp(detectedLevel + movementLevel(delta, stepSemitones), -1, 1);
    const detected: Tone = detectedLevel > 0 ? "H" : detectedLevel < 0 ? "L" : "M";

    return {
      target,
      detected,
      relSemitones: mean - segMeans[0]!,
      deltaSemitones: delta,
      hz: baselineHz * Math.pow(2, mean / 12),
      correct,
    };
  });

  // Contour: do the shifts between syllables move the right way?
  let contourHits = 0;
  let contourTotal = 0;
  for (let i = 1; i < n; i++) {
    contourTotal++;
    const targetDelta = toneValue(targets[i]!) - toneValue(targets[i - 1]!);
    const actualDelta = segMeans[i]! - segMeans[i - 1]!;
    const matched = transitionMatches(actualDelta, targetDelta, stepSemitones);
    if (matched) contourHits++;
  }
  const contourScore = contourTotal ? contourHits / contourTotal : spread <= stepSemitones * 0.55 ? 1 : 0;
  const score = Math.round(contourScore * 100);

  const tips: string[] = [];
  syllables.forEach((s, i) => {
    if (s.correct) return;
    const pos = `syllable ${i + 1}`;
    if (i === 0) return;
    if (s.target === "H") tips.push(`Lift ${pos} from the syllable before it${Math.abs(toneValue(s.target) - toneValue(targets[i - 1]!)) === 2 ? " with a larger leap" : ""}.`);
    else if (s.target === "L") tips.push(`Drop ${pos} from the syllable before it${Math.abs(toneValue(s.target) - toneValue(targets[i - 1]!)) === 2 ? " with a larger step" : ""}.`);
    else if (s.detected === "H") tips.push(`Keep ${pos} level — you rose where the tone should stay flat.`);
    else tips.push(`Keep ${pos} level — you dipped where the tone should stay flat.`);
  });
  if (!allSame && spread < stepSemitones * 0.6)
    tips.push("Your pitch stayed almost flat. Exaggerate the movement at first, then relax it.");
  if (spread > 14)
    tips.push("Your pitch jumped a lot — try smaller, steadier steps so the tones stay distinct but natural.");
  if (!tips.length) tips.push("Clean contour. Try saying it faster while keeping the same tone shape.");

  return {
    ok: true,
    score,
    baselineHz,
    rangeSemitones: spread,
    syllables,
    contourScore,
    tips: tips.slice(0, 3),
    usedCalibration: calibratedStep != null,
    stepSemitones,
  };
}
