/**
 * Benchmark comparing main-thread particle simulation vs Web Worker (Transferable vs Structured Clone).
 */
export interface WorkerBenchResult {
  particleCount: number;
  mainThreadMs: number;
  workerTransferableMs: number;
  workerCloneMs: number;
  conclusion: string;
}

export function runMainThreadSim(count: number, steps: number = 60): number {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) data[i] = (Math.random() - 0.5) * 100;

  const dt = 1 / 60;
  const start = performance.now();
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      const vx = data[o + 2] ?? 0;
      const vy = data[o + 3] ?? 0;
      data[o] = (data[o] ?? 0) + vx * dt;
      data[o + 1] = (data[o + 1] ?? 0) + vy * dt;
    }
  }
  return (performance.now() - start) / steps;
}
