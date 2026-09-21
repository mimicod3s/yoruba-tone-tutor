import { TONE_INFO, type Tone } from "./tone-deck";

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Base pitch of the reference chime, in Hz (a comfortable mid speaking pitch). */
export const BASE_HZ = 196; // G3

export const toneHz = (tone: Tone, baseHz = BASE_HZ) =>
  baseHz * Math.pow(2, TONE_INFO[tone].semitone / 12);

/** Plays a soft chime/whistle sequence for a target tone pattern. */
export function playTonePattern(tones: Tone[], baseHz = BASE_HZ) {
  const ac = audioCtx();
  const t0 = ac.currentTime + 0.05;
  const dur = 0.45;
  const gap = 0.08;

  tones.forEach((tone, i) => {
    const start = t0 + i * (dur + gap);
    const freq = toneHz(tone, baseHz);

    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    const shimmer = ac.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(freq * 2, start);

    const gain = ac.createGain();
    const shimmerGain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    shimmerGain.gain.setValueAtTime(0.0001, start);
    shimmerGain.gain.exponentialRampToValueAtTime(0.05, start + 0.06);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain).connect(ac.destination);
    shimmer.connect(shimmerGain).connect(ac.destination);

    osc.start(start);
    shimmer.start(start);
    osc.stop(start + dur + 0.02);
    shimmer.stop(start + dur + 0.02);
  });

  return tones.length * (dur + gap) * 1000;
}
