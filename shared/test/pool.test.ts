import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../src/pool.ts';

describe('ObjectPool', () => {
  interface TestBullet {
    x: number;
    y: number;
    active: boolean;
  }

  it('pre-allocates requested capacity', () => {
    const pool = new ObjectPool<TestBullet>(
      () => ({ x: 0, y: 0, active: false }),
      (b) => { b.x = 0; b.y = 0; b.active = false; },
      16,
    );
    expect(pool.capacity).toBe(16);
    expect(pool.available).toBe(16);
    expect(pool.activeCount).toBe(0);
  });

  it('acquires and resets items from pool', () => {
    const pool = new ObjectPool<TestBullet>(
      () => ({ x: -1, y: -1, active: false }),
      (b) => { b.x = 0; b.y = 0; b.active = false; },
      4,
    );

    const b1 = pool.acquire();
    expect(b1).not.toBeNull();
    expect(b1?.x).toBe(0);
    expect(pool.available).toBe(3);
    expect(pool.activeCount).toBe(1);

    b1!.x = 50;
    b1!.active = true;

    pool.release(b1!);
    expect(pool.available).toBe(4);
    expect(pool.activeCount).toBe(0);

    const b2 = pool.acquire();
    expect(b2?.x).toBe(0); // Reset function called
  });

  it('returns null when pool is exhausted', () => {
    const pool = new ObjectPool<TestBullet>(
      () => ({ x: 0, y: 0, active: false }),
      (b) => { b.active = false; },
      2,
    );
    const i1 = pool.acquire();
    const i2 = pool.acquire();
    const i3 = pool.acquire();
    expect(i1).not.toBeNull();
    expect(i2).not.toBeNull();
    expect(i3).toBeNull();
  });

  it('ignores double-release of the same item', () => {
    const pool = new ObjectPool<TestBullet>(
      () => ({ x: 0, y: 0, active: false }),
      () => {},
      2,
    );
    const item = pool.acquire()!;
    expect(pool.release(item)).toBe(true);
    expect(pool.release(item)).toBe(false);
  });

  it('releaseAll returns all items to free list and resets them', () => {
    const pool = new ObjectPool<TestBullet>(
      () => ({ x: 0, y: 0, active: false }),
      (b) => { b.x = 0; b.y = 0; b.active = false; },
      4,
    );
    const a = pool.acquire()!;
    const b = pool.acquire()!;
    a.x = 100;
    b.x = 200;
    expect(pool.activeCount).toBe(2);

    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.available).toBe(4);

    const next = pool.acquire()!;
    expect(next.x).toBe(0);
  });
});
