import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoop } from '../src/loop.ts';

describe('Game Loop & Accumulator with Fake Timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs fixed simulation update steps based on elapsed time', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let rafCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });

    const updates: number[] = [];
    const renders: number[] = [];
    const huds: string[] = [];

    createLoop(
      (dt) => updates.push(dt),
      (alpha) => renders.push(alpha),
      (steps, frames, ft) => huds.push(`${steps}/${frames}/${ft}`),
    );

    // Initial frame call
    expect(rafCallback).not.toBeNull();
    now = 1000;
    rafCallback!(now);

    // Advance by 33.33 ms (~2 updates of 16.66ms)
    now = 1034;
    rafCallback!(now);

    expect(updates.length).toBe(2);
    expect(renders.length).toBe(2);
  });

  it('clamps large frame spikes (spiral of death prevention)', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let rafCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });

    let updateCount = 0;
    createLoop(
      () => { updateCount++; },
      () => {},
      () => {},
    );

    rafCallback!(1000);

    // Huge 5-second stall (e.g. background tab)
    now = 6000;
    rafCallback!(now);

    // Frame time is clamped to max 250ms (250 / 16.666 ≈ 15 steps max)
    expect(updateCount).toBeLessThanOrEqual(16);
  });

  it('updates HUD stats after 1000 ms elapsed', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let rafCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });

    let hudUpdated = false;
    createLoop(
      () => {},
      () => {},
      () => { hudUpdated = true; },
    );

    rafCallback!(1000);
    now = 1500;
    rafCallback!(now);
    expect(hudUpdated).toBe(false);

    now = 2050; // 1050ms later -> HUD updates
    rafCallback!(now);
    expect(hudUpdated).toBe(true);
  });
});
