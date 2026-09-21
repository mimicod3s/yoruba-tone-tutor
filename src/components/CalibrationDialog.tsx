import { Check, Mic, Music, RotateCcw, Sparkles, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePitchRecorder } from "@/hooks/use-pitch-recorder";
import {
  analyseCalibration,
  AUTO_PROFILE,
  METHODS,
  withSavedProfile,
  type CalibrationMethod,
  type CalibrationProfile,
  type CalibrationStore,
} from "@/lib/calibration";
import { playSpeechGuide, playTwinkleGuide } from "@/lib/tone-audio";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: CalibrationStore;
  onChange: (store: CalibrationStore) => void;
};

type Phase = "idle" | "recording" | "review";

const METHOD_ORDER: CalibrationMethod[] = ["english", "melody", "auto"];

const ICONS: Record<CalibrationMethod, typeof Mic> = {
  english: Mic,
  melody: Music,
  auto: Sparkles,
};

const timeAgo = (ts: number) => {
  if (!ts) return "";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export function CalibrationDialog({ open, onOpenChange, store, onChange }: Props) {
  const [method, setMethod] = useState<CalibrationMethod>(store.active);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [bands, setBands] = useState<{ low: number; mid: number; high: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CalibrationProfile | null>(null);
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);

  const { status, level, liveHz, start, stop } = usePitchRecorder();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<() => void>(() => {});

  const config = METHODS[method];
  const saved = method === "auto" ? null : store.profiles[method];

  const reset = () => {
    setPhase("idle");
    setBands(null);
    setPending(null);
    setError(null);
    setRange(null);
  };

  useEffect(() => {
    if (open) {
      setMethod(store.active);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase === "recording" && liveHz > 0) {
      setRange((r) => ({ min: Math.min(r?.min ?? liveHz, liveHz), max: Math.max(r?.max ?? liveHz, liveHz) }));
    }
  }, [liveHz, phase]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const finish = () => {
    clearTimer();
    const samples = stop();
    const result = analyseCalibration(samples, method);
    setPhase("review");
    if (result.ok) {
      setError(null);
      setPending(result.profile);
      setBands({
        low: result.profile.lowHz ?? 0,
        mid: result.profile.midHz ?? 0,
        high: result.profile.highHz ?? 0,
      });
    } else {
      setError(result.message);
      setPending(null);
      setBands(null);
    }
  };
  stopRef.current = finish;

  const begin = async () => {
    setError(null);
    setBands(null);
    setPending(null);
    setRange(null);
    const ok = await start();
    if (!ok) {
      setError("Microphone access was blocked. Allow the mic in your browser settings and try again.");
      return;
    }
    setPhase("recording");
    setRemaining(config.seconds);
    clearTimer();
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearTimer();
          stopRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  useEffect(() => clearTimer, []);

  const applyProfile = (profile: CalibrationProfile) => {
    onChange(withSavedProfile(store, profile));
    onOpenChange(false);
  };

  const closeAndReset = (next: boolean) => {
    if (!next && status === "listening") {
      clearTimer();
      stop();
    }
    onOpenChange(next);
  };

  const canApplySaved = !!saved && store.active !== method;
  const primaryDisabled = method === "auto" ? false : !pending && !canApplySaved;

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Calibrate your voice</DialogTitle>
          <DialogDescription>
            Each method keeps its own saved profile, so you can switch between them any time and compare which scores
            your speech more accurately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          {METHOD_ORDER.map((m) => {
            const Icon = ICONS[m];
            const selected = m === method;
            const p = m === "auto" ? null : store.profiles[m];
            return (
              <button
                key={m}
                aria-pressed={selected}
                onClick={() => {
                  if (status === "listening") {
                    clearTimer();
                    stop();
                  }
                  setMethod(m);
                  reset();
                }}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:border-primary/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-semibold">{METHODS[m].title}</span>
                  {store.active === m && (
                    <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-accent">active</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{METHODS[m].subtitle}</p>
                <p className="mt-2 text-xs font-semibold">
                  {m === "auto" ? (
                    <span className="text-muted-foreground">No recording needed</span>
                  ) : p ? (
                    <span className="text-accent">
                      Calibrated at {Math.round(p.midHz ?? 0)} Hz · {timeAgo(p.capturedAt)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not calibrated yet</span>
                  )}
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          {config.prompt && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="min-w-0 text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                “{config.prompt}”
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => (method === "melody" ? playTwinkleGuide() : playSpeechGuide())}
              >
                <Volume2 className="h-4 w-4" />
                {method === "melody" ? "Guide notes" : "Tone guide"}
              </Button>
            </div>
          )}

          <ol className="mt-3 space-y-2">
            {config.steps.map((s, i) => (
              <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>

          {method !== "auto" && (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
              <div className="min-w-0">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-75"
                    style={{ width: `${Math.round(level * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {phase === "recording"
                    ? `${liveHz ? `${liveHz} Hz` : "Listening…"} · ${remaining}s left${
                        range ? ` · range ${Math.round(range.min)}–${Math.round(range.max)} Hz` : ""
                      }`
                    : `About ${config.seconds} seconds of audio`}
                </p>
              </div>
              <Button
                className="shrink-0 gap-2"
                variant={phase === "recording" ? "destructive" : "default"}
                onClick={phase === "recording" ? finish : begin}
              >
                {phase === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {phase === "recording"
                  ? "Stop now"
                  : phase === "review"
                    ? "Record again"
                    : saved
                      ? "Re-record"
                      : "Start recording"}
              </Button>
            </div>
          )}

          {saved && phase === "idle" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Saved bands: Low {Math.round(saved.lowHz ?? 0)} Hz · Mid {Math.round(saved.midHz ?? 0)} Hz · High{" "}
              {Math.round(saved.highHz ?? 0)} Hz. Switch to it without re-recording, or record again to replace it.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>
        )}

        {bands && (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Detected bands</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(
                [
                  ["Low", bands.low, "text-tone-low"],
                  ["Mid", bands.mid, "text-tone-mid"],
                  ["High", bands.high, "text-tone-high"],
                ] as const
              ).map(([label, value, cls]) => (
                <div key={label} className="rounded-xl border border-border bg-background/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-lg font-semibold", cls)}>{Math.round(value)} Hz</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              That's a {(12 * Math.log2(bands.high / bands.low)).toFixed(1)} semitone range — wider is easier to score.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Active profile: <span className="font-semibold text-foreground">{METHODS[store.active].title}</span>
          </p>
          <div className="flex gap-2">
            {method !== "auto" && phase === "review" && (
              <Button variant="ghost" className="gap-2" onClick={begin}>
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            )}
            <Button
              className="gap-2"
              disabled={primaryDisabled}
              onClick={() => {
                if (method === "auto") applyProfile({ ...AUTO_PROFILE, capturedAt: Date.now() });
                else if (pending) applyProfile(pending);
                else if (saved) applyProfile(saved);
              }}
            >
              <Check className="h-4 w-4" />
              {method === "auto"
                ? "Use relative mode"
                : pending
                  ? "Save & use calibration"
                  : canApplySaved
                    ? "Use saved profile"
                    : "Already active"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
