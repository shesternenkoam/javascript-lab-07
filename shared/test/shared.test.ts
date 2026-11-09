import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createWorld, addShip, stepWorld, hashWorld, simSelfTest, sanitizeInput, integrate,
  binaryCodec, jsonCodec, decodeMessage, patchSnapshotAck, mulberry32,
  parseClientMessage,
} from '../src/index.ts';
import { runSession } from './harness.mjs';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('Shared Core Determinism & Protocol (Lab 5/6 Foundation)', () => {
  it('shared/src is pure: no DOM, no Node built-ins, no Math.random / Date.now', () => {
    const forbidden = [
      /Math\.random/, /Date\.now/, /\bdocument\b/, /\bwindow\b/, /\brequire\(/,
      /from ['"]node:/, /\bprocess\./, /\bBuffer\b/, /setTimeout|setInterval/, /performance\.now/,
    ];
    for (const file of readdirSync(srcDir)) {
      const text = readFileSync(path.join(srcDir, file), 'utf8').replace(/\/\/.*$/gm, '');
      for (const re of forbidden) {
        expect(re.test(text), `${file} contains forbidden ${re}`).toBe(false);
      }
    }
  });

  it('determinism: same seed + same inputs -> same hash, twice', () => {
    const h1 = simSelfTest(1000, 12345);
    const h2 = simSelfTest(1000, 12345);
    expect(h1).toBe(h2);
    expect(simSelfTest(1000, 54321)).not.toBe(h1);
  });

  it('input validation rejects cheats instead of clamping them', () => {
    expect(sanitizeInput({ seq: 1, thrust: 0, turn: 1000, fire: 0 })).toBeNull();
    expect(sanitizeInput({ seq: -1, thrust: 0, turn: 0, fire: 0 })).toBeNull();
    expect(sanitizeInput({ seq: 1, thrust: 2, turn: 0, fire: 0 })).toBeNull();
    expect(sanitizeInput({ seq: 5, thrust: 1, turn: -1, fire: 0 })).toEqual({
      seq: 5,
      thrust: 1,
      turn: -1,
      fire: 0,
    });
  });

  it('integrate does not mutate its argument and ignores x/y from inputs', () => {
    const world = createWorld(1);
    const ship = addShip(world);
    const frozen = JSON.stringify(ship);
    const next = integrate(ship, { seq: 1 as any, thrust: 1, turn: 0, fire: 0, x: 99999, y: 99999 });
    expect(JSON.stringify(ship)).toBe(frozen);
    expect(next.x).not.toBe(99999);
  });

  function sampleWorld() {
    const world = createWorld(7);
    for (let i = 0; i < 4; i++) addShip(world);
    const rnd = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const inputs: Record<number, any> = {};
      for (const s of world.ships) {
        inputs[s.id] = {
          seq: i + 1,
          thrust: rnd() < 0.7 ? 1 : 0,
          turn: Math.floor(rnd() * 3) - 1,
          fire: rnd() < 0.3 ? 1 : 0,
        };
      }
      stepWorld(world, inputs);
    }
    return world;
  }

  it('binary input: byte layout is little-endian and versioned', () => {
    const bytes = binaryCodec.encodeInput({ seq: 0x01020304 as any, thrust: 1, turn: -1, fire: 1 });
    expect([...bytes]).toEqual([1, 1, 0x04, 0x03, 0x02, 0x01, 0b11, 0xff]);
    expect(decodeMessage(bytes)).toEqual({ type: 'input', seq: 0x01020304, thrust: 1, fire: 1, turn: -1 });
  });

  it('binary snapshot round trip is exact up to float32 / angle quantization', () => {
    const world = sampleWorld();
    const snap = decodeMessage(patchSnapshotAck(binaryCodec.encodeSnapshot(world, 0), 77)) as any;
    expect(snap.tick).toBe(world.tick);
    expect(snap.ack).toBe(77);
    expect(snap.ships.length).toBe(world.ships.length);
    expect(snap.bullets.length).toBe(world.bullets.length);
    expect(snap.asteroids.length).toBe(world.asteroids.length);
    world.ships.forEach((s, i) => {
      const d = snap.ships[i];
      expect(d.id).toBe(s.id);
      for (const k of ['x', 'y', 'vx', 'vy'] as const) {
        expect(Math.abs(d[k] - s[k])).toBeLessThan(1e-3 * Math.max(1, Math.abs(s[k])));
      }
      expect(Math.abs(d.angle - s.angle)).toBeLessThanOrEqual(0.00005 + 1e-9);
      for (const k of ['hp', 'cooldown', 'respawn'] as const) {
        expect(d[k]).toBe(s[k]);
      }
    });
    world.bullets.forEach((b, i) => {
      expect(snap.bullets[i].seq).toBe(b.seq);
    });
  });

  it('json codec round trip', () => {
    const world = sampleWorld();
    const snap = decodeMessage(jsonCodec.encodeSnapshot(world, 5)) as any;
    expect(snap.ack).toBe(5);
    expect(snap.ships[0].x).toBe(world.ships[0]?.x);
  });

  it('broken binary frames throw', () => {
    const good = binaryCodec.encodeSnapshot(sampleWorld(), 0);
    expect(() => decodeMessage(good.slice(0, good.length - 1))).toThrow();
    expect(() => decodeMessage(new Uint8Array([9, 1, 0, 0, 0, 0, 0, 0]))).toThrow();
    expect(() => decodeMessage(new Uint8Array([1]))).toThrow();
  });

  it('prediction: perfect network -> corrections stay tiny', () => {
    const r = runSession({ lat: 0, seconds: 20 });
    expect(r.meanCorrection).toBeLessThan(0.05);
  });

  it('prediction: 100 ms RTT, jitter and drop -> corrections stay small', () => {
    const r = runSession({ lat: 100, jitter: 30, drop: 0.02, seconds: 30 });
    expect(r.meanCorrection).toBeLessThan(3);
  });

  it('protocol zod parser: parses valid messages and never throws on corrupt input', () => {
    const validJoin = parseClientMessage(JSON.stringify({ type: 'join', room: 'lobby', name: 'Alice' }));
    expect(validJoin.ok).toBe(true);
    if (validJoin.ok) {
      expect(validJoin.value.type).toBe('join');
    }

    const brokenJson = parseClientMessage('{ invalid json');
    expect(brokenJson.ok).toBe(false);

    const invalidPayload = parseClientMessage(JSON.stringify({ type: 'input', turn: 9999 }));
    expect(invalidPayload.ok).toBe(false);

    const unknownType = parseClientMessage(JSON.stringify({ type: 'unknown_action' }));
    expect(unknownType.ok).toBe(false);
  });
});
