import { TONE_INFO, type Tone } from "./tone-deck";
import type { CalibrationProfile } from "./calibration";

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Base pitch of the reference chime, in Hz (a comfortable mid speaking pitch). */
export const BASE_HZ = 196; // G3

function calibratedOffset(tone: Tone, profile?: CalibrationProfile | null) {
  if (profile?.lowHz && profile.midHz && profile.highHz) {
    if (tone === "L") return 12 * Math.log2(profile.lowHz / profile.midHz);
    if (tone === "H") return 12 * Math.log2(profile.highHz / profile.midHz);
    return 0;
  }
  return TONE_INFO[tone].semitone;
}

export const toneHz = (tone: Tone, baseHz = BASE_HZ, profile?: CalibrationProfile | null) =>
  baseHz * Math.pow(2, calibratedOffset(tone, profile) / 12);

/** Plays a soft chime/whistle sequence for a target tone pattern. */
export function playTonePattern(tones: Tone[], profile?: CalibrationProfile | null) {
  const ac = audioCtx();
  const baseHz = profile?.midHz ?? BASE_HZ;
  const t0 = ac.currentTime + 0.05;
  const dur = 0.45;
  const gap = 0.08;

  tones.forEach((tone, i) => {
    const start = t0 + i * (dur + gap);
    const freq = toneHz(tone, baseHz, profile);

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

/** Plays a sequence of semitone offsets from a root as soft guide notes. */
export function playNotes(offsets: number[], rootHz: number, noteDur = 0.42) {
  const ac = audioCtx();
  const t0 = ac.currentTime + 0.05;
  offsets.forEach((semi, i) => {
    const start = t0 + i * noteDur;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(rootHz * Math.pow(2, semi / 12), start);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDur * 0.95);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + noteDur);
  });
  return offsets.length * noteDur * 1000;
}

/** "Twinkle, twinkle, little star, how I wonder what you are" — spans 9 semitones. */
export const TWINKLE_OFFSETS = [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0];

export const playTwinkleGuide = (rootHz = 165) => playNotes(TWINKLE_OFFSETS, rootHz, 0.4);

/** Low → Mid → High reference for the English-phrase method. */
export const playSpeechGuide = (rootHz = 165) => playNotes([-4, 0, 4], rootHz, 0.5);
