import { describe, it, expect } from 'vitest';
import { SpatialHash, type SpatialItem } from '../src/spatialHash.ts';

describe('SpatialHash 2D Grid', () => {
  it('inserts and queries nearby items within radius', () => {
    const grid = new SpatialHash<SpatialItem>(64);
    const itemA: SpatialItem = { id: 1, x: 100, y: 100, radius: 10 };
    const itemB: SpatialItem = { id: 2, x: 120, y: 100, radius: 10 };
    const itemC: SpatialItem = { id: 3, x: 500, y: 500, radius: 10 };

    grid.insert(itemA);
    grid.insert(itemB);
    grid.insert(itemC);

    const nearA = grid.queryRadius(100, 100, 30);
    expect(nearA.map((i) => i.id)).toContain(1);
    expect(nearA.map((i) => i.id)).toContain(2);
    expect(nearA.map((i) => i.id)).not.toContain(3);
  });

  it('handles item straddling across grid cell boundaries', () => {
    const grid = new SpatialHash<SpatialItem>(64);
    // Position near boundary (64)
    const largeItem: SpatialItem = { id: 10, x: 63, y: 63, radius: 20 };
    grid.insert(largeItem);

    // Query from neighboring cells
    const q1 = grid.queryRadius(50, 50, 15);
    const q2 = grid.queryRadius(75, 75, 15);
    expect(q1.map((i) => i.id)).toContain(10);
    expect(q2.map((i) => i.id)).toContain(10);
  });

  it('does not duplicate items in query results', () => {
    const grid = new SpatialHash<SpatialItem>(64);
    const item: SpatialItem = { id: 5, x: 64, y: 64, radius: 30 };
    grid.insert(item);

    const results = grid.queryRadius(64, 64, 40);
    expect(results.filter((i) => i.id === 5).length).toBe(1);
  });

  it('clears all items from grid cells', () => {
    const grid = new SpatialHash<SpatialItem>(64);
    grid.insert({ id: 1, x: 10, y: 10 });
    expect(grid.queryRadius(10, 10, 5).length).toBe(1);

    grid.clear();
    expect(grid.queryRadius(10, 10, 5).length).toBe(0);
  });

  it('returns empty array when no items are in radius', () => {
    const grid = new SpatialHash<SpatialItem>(64);
    grid.insert({ id: 1, x: 100, y: 100 });
    const res = grid.queryRadius(0, 0, 10);
    expect(res).toEqual([]);
  });
});

