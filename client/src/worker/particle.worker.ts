/**
 * Web Worker for offloading particle physics simulation.
 * Uses typed Float32Array to simulate physics off the main thread.
 */

// Structure: 4 floats per particle: [x, y, vx, vy]
let count = 0;
let particleData = new Float32Array(0);

self.onmessage = (e: MessageEvent): void => {
  const { type, dt, buffer, totalCount } = e.data;
  if (type === 'init') {
    count = totalCount;
    particleData = new Float32Array(buffer);
  } else if (type === 'update') {
    const data = new Float32Array(buffer);
    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      const vx = data[offset + 2] ?? 0;
      const vy = data[offset + 3] ?? 0;
      data[offset] = (data[offset] ?? 0) + vx * dt;
      data[offset + 1] = (data[offset + 1] ?? 0) + vy * dt;
    }
    // Transfer buffer back to main thread
    self.postMessage({ type: 'updateDone', buffer: data.buffer }, { transfer: [data.buffer] });
  }
};
