import { createFileRoute } from "@tanstack/react-router";
import { Check, Mic, Settings2, Square, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CalibrationDialog } from "@/components/CalibrationDialog";
import { PitchLane } from "@/components/PitchLane";
import { Button } from "@/components/ui/button";
import { usePitchRecorder } from "@/hooks/use-pitch-recorder";
import {
  EMPTY_STORE,
  METHODS,
  activeProfile,
  isCalibrated,
  loadStore,
  saveStore,
  type CalibrationStore,
} from "@/lib/calibration";
import { evaluateContour, type Evaluation, type PitchSample } from "@/lib/evaluate-tones";
import { playTonePattern } from "@/lib/tone-audio";
import { DECK, TONE_INFO, type Tone, type ToneWord } from "@/lib/tone-deck";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yorùbá Tone Trainer — practice high, mid and low tones aloud" },
      {
        name: "description",
        content:
          "Say Yorùbá minimal pairs out loud and get instant feedback on whether you hit the high, mid or low tone, with a live pitch contour and reference chimes.",
      },
      { property: "og:title", content: "Yorùbá Tone Trainer" },
      {
        property: "og:description",
        content:
          "Practice Yorùbá high, mid and low tones with live pitch detection, target pitch rails and per-syllable scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const toneClass: Record<Tone, string> = {
  H: "text-tone-high border-tone-high/50 bg-tone-high/10",
  M: "text-tone-mid border-tone-mid/50 bg-tone-mid/10",
  L: "text-tone-low border-tone-low/50 bg-tone-low/10",
};

function ToneChip({ tone }: { tone: Tone }) {
  const info = TONE_INFO[tone];
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", toneClass[tone])}>
      {info.label} · {info.mark} · {info.solfa}
    </span>
  );
}

type Attempt = {
  id: number;
  at: number;
  score: number;
  evaluation: Evaluation;
  samples: PitchSample[];
  baselineHz: number;
};

const MAX_ATTEMPTS = 3;

function Index() {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [selectedAttempt, setSelectedAttempt] = useState<number | null>(null);
  const [store, setStore] = useState<CalibrationStore>(EMPTY_STORE);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const frozen = useRef(false);
  const viewSamplesRef = useRef<PitchSample[]>([]);
  const viewBaselineRef = useRef<number | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  const profile = useMemo(() => activeProfile(store), [store]);

  const handleStoreChange = (next: CalibrationStore) => {
    setStore(next);
    saveStore(next);
  };

  const word: ToneWord = DECK[index]!;
  const { status, level, liveHz, samplesRef, baselineRef, start, stop } = usePitchRecorder();
  const listening = status === "listening";

  const wordAttempts = attempts[word.id] ?? [];
  const current =
    selectedAttempt != null ? (wordAttempts.find((a) => a.id === selectedAttempt) ?? null) : null;
  const result = current?.evaluation ?? null;

  const groups = useMemo(() => {
    const map = new Map<string, ToneWord[]>();
    DECK.forEach((w) => map.set(w.group, [...(map.get(w.group) ?? []), w]));
    return [...map.entries()];
  }, []);

  const showAttempt = (attempt: Attempt) => {
    viewSamplesRef.current = attempt.samples;
    viewBaselineRef.current = attempt.baselineHz;
    frozen.current = true;
    setSelectedAttempt(attempt.id);
  };

  const handleStart = async () => {
    setSelectedAttempt(null);
    frozen.current = false;
    await start();
  };

  const handleStop = () => {
    const samples = [...stop()];
    frozen.current = true;
    const evaluation = evaluateContour(samples, word.tones, profile);
    if (!evaluation.ok) {
      viewSamplesRef.current = samples;
      viewBaselineRef.current = null;
      setAttempts((a) => ({ ...a }));
      setSelectedAttempt(null);
      setFailed(evaluation);
      return;
    }
    setFailed(null);
    const attempt: Attempt = {
      id: Date.now(),
      at: Date.now(),
      score: evaluation.score,
      evaluation,
      samples,
      baselineHz: evaluation.baselineHz,
    };
    setAttempts((a) => ({ ...a, [word.id]: [...(a[word.id] ?? []), attempt].slice(-MAX_ATTEMPTS) }));
    setHistory((h) => ({ ...h, [word.id]: Math.max(h[word.id] ?? 0, evaluation.score) }));
    showAttempt(attempt);
  };

  const [failed, setFailed] = useState<Evaluation | null>(null);

  const pick = (i: number) => {
    if (listening) stop();
    frozen.current = false;
    setIndex(i);
    setSelectedAttempt(null);
    setFailed(null);
    viewSamplesRef.current = [];
    viewBaselineRef.current = null;
  };

  const attempted = Object.keys(history).length;
  const best = attempted
    ? Math.round(Object.values(history).reduce((a, b) => a + b, 0) / attempted)
    : 0;

  return (
    <main className="min-h-screen bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 30% 0%, oklch(0.35 0.09 78 / 0.5), transparent 70%), radial-gradient(50% 90% at 85% 10%, oklch(0.4 0.1 300 / 0.45), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Ohùn Yorùbá</p>
            <h1
              className="mt-1 truncate text-3xl font-semibold sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tone Trainer
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="secondary" className="gap-2" onClick={() => setCalibrationOpen(true)}>
              <Settings2 className="h-4 w-4" /> Calibrate voice
            </Button>
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Average best</p>
              <p className="text-xl font-semibold text-primary">{attempted ? `${best}%` : "—"}</p>
            </div>
          </div>
        </header>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Yorùbá has three tones: <span className="text-tone-high">high (á)</span>,{" "}
          <span className="text-tone-mid">mid (a)</span> and <span className="text-tone-low">low (à)</span>. Listen to
          the target melody, say the word out loud, and your pitch is scored on the shifts between syllables — relative
          to your own voice, not a fixed note.
        </p>

        <button
          onClick={() => setCalibrationOpen(true)}
          className="mt-5 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left transition-colors hover:border-primary/50"
        >
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calibration</span>
          <span className="text-sm font-semibold">{METHODS[profile.method].title}</span>
          {isCalibrated(profile) ? (
            <span className="text-xs text-muted-foreground">
              Low {Math.round(profile.lowHz!)} Hz · Mid {Math.round(profile.midHz!)} Hz · High{" "}
              {Math.round(profile.highHz!)} Hz
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Judging each attempt against itself — calibrate for sharper scoring on all-low or all-high words.
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Saved: {METHODS.english.title} {store.profiles.english ? "✓" : "—"} · {METHODS.melody.title}{" "}
            {store.profiles.melody ? "✓" : "—"}
          </span>
          <span className="ml-auto text-xs font-semibold text-primary">Switch</span>
        </button>

        {/* Word card */}
        <section className="mt-8 rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <h2
                className="text-4xl font-semibold leading-tight sm:text-6xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {word.word}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{word.meaning}</p>
            </div>
            <Button
              variant="secondary"
              className="shrink-0 gap-2"
              onClick={() => playTonePattern(word.tones)}
              aria-label={`Hear the target pitch for ${word.word}`}
            >
              <Volume2 className="h-4 w-4" /> Hear target
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {word.syllables.map((syl, i) => (
              <div
                key={`${syl}-${i}`}
                className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-background/40 px-4 py-3"
              >
                <span className="text-xl font-semibold">{syl}</span>
                <ToneChip tone={word.tones[i]!} />
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{word.gloss}</p>

          <div className="mt-6">
            <PitchLane
              tones={word.tones}
              samplesRef={listening ? samplesRef : viewSamplesRef}
              baselineRef={listening ? baselineRef : viewBaselineRef}
              active={listening || (frozen.current && !!result?.ok)}
            />
          </div>

          {wordAttempts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Recent attempts · {word.word}
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Recent attempts">
                {wordAttempts.map((a, i) => {
                  const isLatest = i === wordAttempts.length - 1;
                  const selected = a.id === selectedAttempt;
                  return (
                    <button
                      key={a.id}
                      aria-pressed={selected}
                      onClick={() => showAttempt(a)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        selected
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card/60 text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      Attempt {i + 1} {isLatest ? "(latest: " : "("}
                      {a.score}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-75"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {listening ? (liveHz ? `Hearing ${liveHz} Hz` : "Listening…") : "Mic idle"}
              </p>
            </div>
            <Button
              size="lg"
              className="shrink-0 gap-2"
              variant={listening ? "destructive" : "default"}
              onClick={listening ? handleStop : handleStart}
            >
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Stop & score" : "Record attempt"}
            </Button>
          </div>

          {status === "denied" && (
            <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              Microphone access was blocked. Allow the mic in your browser settings, then try again.
            </p>
          )}
          {status === "unsupported" && (
            <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              This browser doesn't support microphone recording. Try Chrome, Edge or Safari.
            </p>
          )}

          {failed && !failed.ok && (
            <p className="mt-4 rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm text-muted-foreground">
              {failed.message}
            </p>
          )}

          {result?.ok && (
            <div className="mt-6 rounded-3xl border border-border bg-background/50 p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Accuracy</p>
                  <p className="text-3xl font-semibold text-primary">{result.score}%</p>
                </div>
                <p className="shrink-0 text-right text-xs text-muted-foreground">
                  {result.usedCalibration ? "Calibrated mid" : "Baseline"} {Math.round(result.baselineHz)} Hz
                  <br />
                  Range used {result.rangeSemitones.toFixed(1)} semitones
                  <br />
                  {result.usedCalibration ? `Scored with ${METHODS[profile.method].title}` : "Scored relatively"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {result.syllables.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3",
                      s.correct ? "border-accent/50 bg-accent/10" : "border-destructive/50 bg-destructive/10",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                        s.correct ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {s.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{word.syllables[i]}</p>
                      <p className="text-xs text-muted-foreground">
                        target {TONE_INFO[s.target].label} · you sang {TONE_INFO[s.detected].label} (
                        {s.relSemitones > 0 ? "+" : ""}
                        {s.relSemitones.toFixed(1)} st · {Math.round(s.hz)} Hz)
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <ul className="mt-4 space-y-2">
                {result.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Deck */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Minimal-pair deck
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Same letters, different melody — these pairs are where tone carries the whole meaning.
          </p>

          <div className="mt-5 space-y-6">
            {groups.map(([group, words]) => (
              <div key={group}>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{group}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {words.map((w) => {
                    const i = DECK.indexOf(w);
                    const scored = history[w.id];
                    return (
                      <button
                        key={w.id}
                        onClick={() => pick(i)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          i === index
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card/60 hover:border-primary/50",
                        )}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                          <span
                            className="truncate text-xl font-semibold"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {w.word}
                          </span>
                          {scored != null && (
                            <span className="shrink-0 text-xs font-semibold text-primary">{scored}%</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{w.meaning}</p>
                        <div className="mt-3 flex gap-1.5">
                          {w.tones.map((t, ti) => (
                            <span
                              key={ti}
                              className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", toneClass[t])}
                            >
                              {TONE_INFO[t].mark}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 text-xs text-muted-foreground">
          Scoring compares the pitch shifts between syllables against the target tone pattern, normalised to your own
          speaking pitch — so any voice range works.
        </footer>
      </div>

      <CalibrationDialog
        open={calibrationOpen}
        onOpenChange={setCalibrationOpen}
        store={store}
        onChange={handleStoreChange}
      />
    </main>
  );
}
