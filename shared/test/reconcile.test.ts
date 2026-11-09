import { describe, it, expect } from 'vitest';
import { reconcile, wrapDelta } from '../src/reconcile.ts';
import { asEntityId, asSeq, asTick, type PlayerInput, type Ship, type Snapshot } from '../src';

describe('Reconciliation pure function', () => {
  const baseShip: Ship = {
    id: asEntityId(1),
    x: 100,
    y: 100,
    vx: 10,
    vy: 0,
    angle: 0,
    hp: 100,
    cooldown: 0,
    respawn: 0,
  };

  const createSnapshot = (ack: number, shipOverride?: Partial<Ship>): Snapshot => ({
    type: 'snapshot',
    tick: asTick(10),
    ack: asSeq(ack),
    ships: [{
      kind: 'ship',
      ...baseShip,
      ...shipOverride,
    }],
    bullets: [],
    asteroids: [],
  });

  it('filters acknowledged inputs from unacknowledged buffer', () => {
    const inputs: PlayerInput[] = [
      { seq: asSeq(1), thrust: 1, turn: 0, fire: 0 },
      { seq: asSeq(2), thrust: 1, turn: 0, fire: 0 },
      { seq: asSeq(3), thrust: 0, turn: 1, fire: 0 },
    ];
    const snap = createSnapshot(2);

    const result = reconcile(baseShip, inputs, snap, asEntityId(1));
    expect(result).not.toBeNull();
    expect(result!.remainingInputs.map((i) => i.seq)).toEqual([asSeq(3)]);
  });

  it('computes zero correction when predicted state matches authoritative replay', () => {
    const inputs: PlayerInput[] = [];
    const snap = createSnapshot(5, { x: 100, y: 100 });

    const result = reconcile(baseShip, inputs, snap, asEntityId(1));
    expect(result!.correction).toBe(0);
    expect(result!.offsetDelta.x).toBe(0);
    expect(result!.offsetDelta.y).toBe(0);
    expect(result!.snapped).toBe(false);
  });

  it('calculates position offset delta when client mispredicted', () => {
    const predictedShip = { ...baseShip, x: 105, y: 100 };
    const snap = createSnapshot(1, { x: 100, y: 100 });

    const result = reconcile(predictedShip, [], snap, asEntityId(1));
    expect(result!.correction).toBe(5);
    expect(result!.offsetDelta.x).toBe(5);
    expect(result!.snapped).toBe(false);
  });

  it('snaps immediately if correction exceeds SNAP_DISTANCE', () => {
    const predictedShip = { ...baseShip, x: 500, y: 500 };
    const snap = createSnapshot(1, { x: 100, y: 100 });

    const result = reconcile(predictedShip, [], snap, asEntityId(1));
    expect(result!.correction).toBeGreaterThan(120);
    expect(result!.snapped).toBe(true);
    expect(result!.offsetDelta).toEqual({ x: 0, y: 0, angle: 0 });
  });

  it('returns null if client ship is not present in server snapshot', () => {
    const snap: Snapshot = {
      type: 'snapshot',
      tick: asTick(1),
      ack: asSeq(1),
      ships: [],
      bullets: [],
      asteroids: [],
    };
    const result = reconcile(baseShip, [], snap, asEntityId(99));
    expect(result).toBeNull();
  });

  it('wraps deltas around world toroidal boundary', () => {
    // Ship at edge x=10 vs server x=1270 (world width 1280) -> shortest delta is -20, not +1260
    expect(wrapDelta(10 - 1270, 1280)).toBe(20);
    expect(wrapDelta(1270 - 10, 1280)).toBe(-20);
  });
});
