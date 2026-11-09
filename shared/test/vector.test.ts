import { describe, it, expect } from 'vitest';
import { Vector2, scratchVec1, scratchVec2 } from '../src/vector.ts';

describe('Vector2', () => {
  it('creates vector with default coordinates', () => {
    const v = new Vector2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('creates vector with given coordinates', () => {
    const v = Vector2.create(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('sets coordinates in-place', () => {
    const v = new Vector2();
    v.set(10, 20);
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it('copies other coordinates', () => {
    const v1 = new Vector2(5, 7);
    const v2 = new Vector2().copy(v1);
    expect(v2.x).toBe(5);
    expect(v2.y).toBe(7);
  });

  it('clones into a new instance', () => {
    const v1 = new Vector2(1, 2);
    const v2 = v1.clone();
    expect(v2).not.toBe(v1);
    expect(v2.x).toBe(1);
    expect(v2.y).toBe(2);
  });

  it('adds vectors in-place', () => {
    const v1 = new Vector2(1, 2);
    v1.add({ x: 3, y: 4 });
    expect(v1.x).toBe(4);
    expect(v1.y).toBe(6);
  });

  it('subtracts vectors in-place', () => {
    const v1 = new Vector2(10, 20);
    v1.sub({ x: 3, y: 5 });
    expect(v1.x).toBe(7);
    expect(v1.y).toBe(15);
  });

  it('scales vector in-place', () => {
    const v = new Vector2(3, 4);
    v.scale(2.5);
    expect(v.x).toBe(7.5);
    expect(v.y).toBe(10);
  });

  it('adds scaled vector in-place', () => {
    const v1 = new Vector2(1, 2);
    v1.addScaled({ x: 2, y: 3 }, 3);
    expect(v1.x).toBe(7);
    expect(v1.y).toBe(11);
  });

  it('calculates dot product correctly', () => {
    const v1 = new Vector2(2, 3);
    expect(v1.dot({ x: 4, y: 5 })).toBe(23);
  });

  it('calculates length and length squared', () => {
    const v = new Vector2(3, 4);
    expect(v.lenSq()).toBe(25);
    expect(v.len()).toBe(5);
  });

  it('calculates distance and distance squared', () => {
    const v1 = new Vector2(1, 1);
    const v2 = new Vector2(4, 5);
    expect(v1.distSq(v2)).toBe(25);
    expect(v1.dist(v2)).toBe(5);
  });

  it('normalizes non-zero vector', () => {
    const v = new Vector2(0, 10);
    v.normalize();
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
    expect(v.len()).toBeCloseTo(1);
  });

  it('normalizing zero vector yields zero vector', () => {
    const v = new Vector2(0, 0);
    v.normalize();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('zeroes vector in-place', () => {
    const v = new Vector2(5, 5);
    v.zero();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('provides global scratch vectors for allocation-free loops', () => {
    scratchVec1.set(1, 2);
    scratchVec2.set(3, 4);
    expect(scratchVec1.dot(scratchVec2)).toBe(11);
  });
});
