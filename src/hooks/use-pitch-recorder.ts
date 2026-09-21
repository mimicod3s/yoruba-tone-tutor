import { useCallback, useEffect, useRef, useState } from "react";

import type { PitchSample } from "@/lib/evaluate-tones";
import { detectPitch, median } from "@/lib/pitch";

type Status = "idle" | "listening" | "denied" | "unsupported";

export function usePitchRecorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [liveHz, setLiveHz] = useState(0);

  const samplesRef = useRef<PitchSample[]>([]);
  const baselineRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setStatus("idle");
    setLevel(0);
    setLiveHz(0);
    return samplesRef.current;
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      samplesRef.current = [];
      baselineRef.current = null;
      const t0 = performance.now();

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let rms = 0;
        for (let i = 0; i < buf.length; i++) rms += buf[i]! * buf[i]!;
        setLevel(Math.min(1, Math.sqrt(rms / buf.length) * 8));

        const hz = detectPitch(buf, ctx.sampleRate);
        samplesRef.current.push({ t: performance.now() - t0, hz });
        if (hz > 0) {
          setLiveHz(Math.round(hz));
          const voiced = samplesRef.current.filter((s) => s.hz > 0).map((s) => s.hz);
          if (voiced.length >= 5) baselineRef.current = median(voiced);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setStatus("listening");
      return true;
    } catch {
      setStatus("denied");
      return false;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { status, level, liveHz, samplesRef, baselineRef, start, stop };
}
