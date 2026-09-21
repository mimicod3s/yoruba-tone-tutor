import { useEffect, useRef } from "react";

import type { PitchSample } from "@/lib/evaluate-tones";
import { TONE_INFO, type Tone } from "@/lib/tone-deck";

type Props = {
  tones: Tone[];
  samplesRef: React.RefObject<PitchSample[]>;
  baselineRef: React.RefObject<number | null>;
  windowMs?: number;
  active: boolean;
};

const RANGE = 11; // semitones shown above/below baseline

const toneColor = (tone: Tone) =>
  tone === "H" ? "rgba(247, 184, 74, 1)" : tone === "M" ? "rgba(122, 196, 180, 1)" : "rgba(186, 147, 232, 1)";

export function PitchLane({ tones, samplesRef, baselineRef, windowMs = 3000, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;

    const draw = () => {
      const parent = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w = parent?.clientWidth ?? 600;
      const h = parent?.clientHeight ?? 220;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const yFor = (st: number) => h / 2 - (st / RANGE) * (h / 2 - 14);

      // Guide rails for each tone level
      (["H", "M", "L"] as Tone[]).forEach((tone) => {
        const y = yFor(TONE_INFO[tone].semitone);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "500 11px Manrope, system-ui, sans-serif";
        ctx.fillText(`${TONE_INFO[tone].label} · ${TONE_INFO[tone].solfa}`, 6, y - 6);
      });

      // Target bars per syllable
      const segW = w / tones.length;
      tones.forEach((tone, i) => {
        const y = yFor(TONE_INFO[tone].semitone);
        const x = i * segW + segW * 0.1;
        const barW = segW * 0.8;
        ctx.fillStyle = toneColor(tone);
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.roundRect(x, y - 9, barW, 18, 9);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = toneColor(tone);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y - 9, barW, 18, 9);
        ctx.stroke();

        if (i > 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(i * segW, 0);
          ctx.lineTo(i * segW, h);
          ctx.stroke();
        }
      });

      // Live voice contour
      const samples = samplesRef.current ?? [];
      const baseline = baselineRef.current;
      if (samples.length > 1 && baseline) {
        const last = samples[samples.length - 1]!.t;
        const t0 = Math.max(0, last - windowMs);
        const span = Math.max(windowMs, last - t0);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 252, 245, 0.95)";
        ctx.shadowColor = "rgba(247, 184, 74, 0.7)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        let drawing = false;
        for (const s of samples) {
          if (s.t < t0) continue;
          if (s.hz <= 0) {
            drawing = false;
            continue;
          }
          const st = 12 * Math.log2(s.hz / baseline);
          const x = ((s.t - t0) / span) * w;
          const y = yFor(Math.max(-RANGE, Math.min(RANGE, st)));
          if (!drawing) {
            ctx.moveTo(x, y);
            drawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tones, samplesRef, baselineRef, windowMs, active]);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-3xl border border-border bg-[oklch(0.22_0.03_300)]">
      <canvas ref={canvasRef} className="h-full w-full" />
      {!active && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 grid place-items-center">
          <p className="rounded-full bg-background/70 px-4 py-1.5 text-xs text-muted-foreground">
            Your voice contour will be drawn here
          </p>
        </div>
      )}
    </div>
  );
}
