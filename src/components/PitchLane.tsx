import { useMemo } from "react";

import type { CalibrationProfile } from "@/lib/calibration";
import { TONE_INFO, type Tone } from "@/lib/tone-deck";
import { cn } from "@/lib/utils";

type Props = {
  tones: Tone[];
  liveHz: number;
  baselineHz: number | null;
  profile?: CalibrationProfile | null;
  active: boolean;
};

const lanePosition: Record<Tone, number> = { H: 14, M: 50, L: 86 };

const toneTextClass: Record<Tone, string> = {
  H: "text-tone-high",
  M: "text-tone-mid",
  L: "text-tone-low",
};

export function PitchLane({ tones, liveHz, baselineHz, profile, active }: Props) {
  const position = useMemo(() => {
    if (!active || liveHz <= 0) return 50;
    const mid = profile?.midHz ?? baselineHz ?? liveHz;
    const lowStep = profile?.lowHz && profile.midHz ? Math.abs(12 * Math.log2(profile.midHz / profile.lowHz)) : 4;
    const highStep = profile?.highHz && profile.midHz ? Math.abs(12 * Math.log2(profile.highHz / profile.midHz)) : 4;
    const relative = 12 * Math.log2(liveHz / mid);
    const scaled = relative >= 0 ? relative / Math.max(1, highStep) : relative / Math.max(1, lowStep);
    return Math.max(8, Math.min(92, 50 - scaled * 36));
  }, [active, baselineHz, liveHz, profile]);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-border bg-background/50" aria-label="Live pitch gauge">
      {(["H", "M", "L"] as Tone[]).map((tone) => (
        <div key={tone} className="absolute inset-x-4" style={{ top: `${lanePosition[tone]}%` }}>
          <div className="border-t border-dashed border-border" />
          <span className={cn("absolute -top-6 left-0 text-xs font-semibold", toneTextClass[tone])}>
            {TONE_INFO[tone].label} · {TONE_INFO[tone].mark} · {TONE_INFO[tone].solfa}
          </span>
        </div>
      ))}

      <div className="absolute inset-y-0 left-1/2 border-l border-border/60" />
      <div
        className={cn(
          "absolute left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-lg transition-[top,opacity,transform] duration-150",
          active && liveHz > 0 ? "border-primary bg-primary text-primary-foreground opacity-100" : "border-border bg-card text-muted-foreground opacity-60",
        )}
        style={{ top: `${position}%` }}
      >
        <span className="text-xs font-bold">{liveHz > 0 && active ? liveHz : "—"}</span>
      </div>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label="Target tone sequence">
        {tones.map((tone, index) => (
          <span key={`${tone}-${index}`} className={cn("grid h-7 w-7 place-items-center rounded-full border text-xs font-bold", tone === "H" ? "border-tone-high/60 bg-tone-high/10 text-tone-high" : tone === "M" ? "border-tone-mid/60 bg-tone-mid/10 text-tone-mid" : "border-tone-low/60 bg-tone-low/10 text-tone-low")}>
            {TONE_INFO[tone].solfa}
          </span>
        ))}
      </div>
    </div>
  );
}