/** Autocorrelation-based fundamental frequency detection (ACF2+ style). */
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.012) return -1; // too quiet / unvoiced

  // Trim near-silent edges
  const threshold = 0.2;
  let start = 0;
  let end = SIZE - 1;
  while (start < SIZE / 2 && Math.abs(buffer[start]) < threshold) start++;
  while (end > SIZE / 2 && Math.abs(buffer[end]) < threshold) end--;

  const trimmed = buffer.slice(start, end);
  const n = trimmed.length;
  if (n < 512) return -1;

  const c = new Float32Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return -1;

  // Parabolic interpolation around the peak
  const x1 = c[maxPos - 1] ?? c[maxPos];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? c[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const period = a ? maxPos - b / (2 * a) : maxPos;

  const freq = sampleRate / period;
  if (freq < 60 || freq > 500) return -1;

  // Clarity gate
  const clarity = maxVal / (c[0] || 1);
  if (clarity < 0.3) return -1;

  return freq;
}

export const hzToSemitones = (hz: number, ref: number) => 12 * Math.log2(hz / ref);

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Light median smoothing to kill octave-jump outliers. */
export function smooth(values: number[], window = 5): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - Math.floor(window / 2)), i + Math.ceil(window / 2));
    return median(slice);
  });
}
