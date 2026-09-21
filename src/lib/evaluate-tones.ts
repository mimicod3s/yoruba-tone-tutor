import { median, smooth } from "./pitch";
import type { CalibrationProfile } from "./calibration";
import type { Tone } from "./tone-deck";

export type PitchSample = { t: number; hz: number };

export type SyllableResult = {
  target: Tone;
  detected: Tone;
  relSemitones: number;
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
  /** True when saved calibration bands were used to judge absolute pitch. */
  usedCalibration: boolean;
};

const toneValue = (t: Tone) => (t === "H" ? 1 : t === "M" ? 0 : -1);

function classifyRelative(rel: number, spread: number): Tone {
  // Threshold scales with how much range the speaker actually used.
  const thr = Math.max(0.9, Math.min(2.2, spread * 0.35));
  if (rel > thr) return "H";
  if (rel < -thr) return "L";
  return "M";
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

  const calibrated =
    !!profile && profile.method !== "auto" && !!profile.lowHz && !!profile.midHz && !!profile.highHz;
  const refHz = calibrated ? profile!.midHz! : utteranceMedian;
  const driftSemitones = 12 * Math.log2(utteranceMedian / refHz);
  // If the speaker is in a very different register than at calibration time,
  // absolute bands would mislabel everything — fall back to relative judging.
  const useCalibration = calibrated && Math.abs(driftSemitones) <= 6;
  const baselineHz = useCalibration ? refHz : utteranceMedian;

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
  const centre = segMeans.reduce((a, b) => a + b, 0) / n;

  const first = targets[0]!;
  const allSame = targets.every((t) => t === first);

  // Calibrated band edges, in semitones relative to the calibrated mid.
  let thrHigh = 1.5;
  let thrLow = -1.5;
  if (useCalibration) {
    const highSt = 12 * Math.log2(profile!.highHz! / profile!.midHz!);
    const lowSt = 12 * Math.log2(profile!.lowHz! / profile!.midHz!);
    thrHigh = Math.max(1.2, highSt * 0.45);
    thrLow = Math.min(-1.2, lowSt * 0.45);
  }

  const syllables: SyllableResult[] = targets.map((target, i) => {
    const mean = segMeans[i]!;
    const rel = mean - centre;
    let detected: Tone;

    if (useCalibration) {
      // Absolute placement against the user's own calibrated bands.
      detected = mean > thrHigh ? "H" : mean < thrLow ? "L" : "M";
    } else if (allSame) {
      detected = spread < 2.2 ? first : classifyRelative(mean, spread);
    } else {
      detected = classifyRelative(rel, spread);
    }

    return {
      target,
      detected,
      relSemitones: useCalibration ? mean : rel,
      hz: baselineHz * Math.pow(2, mean / 12),
      correct: detected === target,
    };
  });

  // Contour: do the shifts between syllables move the right way?
  let contourHits = 0;
  let contourTotal = 0;
  for (let i = 1; i < n; i++) {
    contourTotal++;
    const targetDelta = toneValue(targets[i]!) - toneValue(targets[i - 1]!);
    const actualDelta = segMeans[i]! - segMeans[i - 1]!;
    const matched =
      targetDelta === 0
        ? Math.abs(actualDelta) < 1.6
        : Math.sign(actualDelta) === Math.sign(targetDelta) && Math.abs(actualDelta) > 0.8;
    if (matched) contourHits++;
  }
  const contourScore = contourTotal ? contourHits / contourTotal : syllables[0]!.correct ? 1 : 0;
  const syllScore = syllables.filter((s) => s.correct).length / n;
  const score = Math.round((syllScore * 0.7 + contourScore * 0.3) * 100);

  const tips: string[] = [];
  syllables.forEach((s, i) => {
    if (s.correct) return;
    const pos = `syllable ${i + 1}`;
    if (s.target === "H") tips.push(`Lift ${pos} higher — high tone sits clearly above your speaking pitch.`);
    else if (s.target === "L") tips.push(`Drop ${pos} lower — low tone falls below your speaking pitch.`);
    else if (s.detected === "H") tips.push(`Keep ${pos} level — you rose where the tone should stay flat.`);
    else tips.push(`Keep ${pos} level — you dipped where the tone should stay flat.`);
  });
  if (!allSame && spread < 1.5)
    tips.push("Your pitch stayed almost flat. Exaggerate the movement at first, then relax it.");
  if (spread > 14)
    tips.push("Your pitch jumped a lot — try smaller, steadier steps so the tones stay distinct but natural.");
  if (calibrated && !useCalibration)
    tips.push("You spoke in a very different register than your calibration — recalibrate for sharper scoring.");
  if (!tips.length) tips.push("Clean contour. Try saying it faster while keeping the same tone shape.");

  return {
    ok: true,
    score,
    baselineHz,
    rangeSemitones: spread,
    syllables,
    contourScore,
    tips: tips.slice(0, 3),
    usedCalibration: useCalibration,
  };
}
