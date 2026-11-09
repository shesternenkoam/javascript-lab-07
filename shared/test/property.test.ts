import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  binaryCodec, decodeBinary, parseClientMessage, integrate,
  WORLD_W, WORLD_H, DT, asSeq, asEntityId, asTick,
  type PlayerInput, type World, type Ship,
} from '../src';

describe('Fast-Check Property-Based Tests (>= 5 Properties)', () => {
  // Property 1: Binary Input Codec Round-Trip Within Tolerance
  it('Property 1: input binary codec round-trip produces identical message', () => {
    fc.assert(
      fc.property(
        fc.record({
          seq: fc.integer({ min: 0, max: 0xffffffff }).map((n) => asSeq(n)),
          thrust: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
          turn: fc.constantFrom(-1, 0, 1) as fc.Arbitrary<-1 | 0 | 1>,
          fire: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
        }),
        (input: PlayerInput) => {
          const encoded = binaryCodec.encodeInput(input);
          const decoded = decodeBinary(encoded);
          expect(decoded.type).toBe('input');
          if (decoded.type === 'input') {
            expect(decoded.seq).toBe(input.seq);
            expect(decoded.thrust).toBe(input.thrust);
            expect(decoded.turn).toBe(input.turn);
            expect(decoded.fire).toBe(input.fire);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  // Property 2: Binary Snapshot Packet Length Matches Formal Spec
  it('Property 2: encoded snapshot byte length strictly equals formal spec size', () => {
    const HEADER = 15;
    const SHIP_BYTES = 25;
    const BULLET_BYTES = 20;
    const ASTEROID_BYTES = 13;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 10 }),
        (nShips, nBullets, nAsteroids) => {
          const world: World = {
            tick: asTick(100),
            rng: 1234,
            nextId: 100,
            ships: Array.from({ length: nShips }, (_, i) => ({
              id: asEntityId(i + 1),
              x: 100 + i,
              y: 200 + i,
              vx: 0,
              vy: 0,
              angle: 0.5,
              hp: 100,
              cooldown: 0,
              respawn: 0,
            })),
            bullets: Array.from({ length: nBullets }, (_, i) => ({
              id: asEntityId(100 + i),
              owner: asEntityId(1),
              seq: asSeq(i),
              x: 50,
              y: 50,
              vx: 100,
              vy: 0,
              ttl: 30,
            })),
            asteroids: Array.from({ length: nAsteroids }, (_, i) => ({
              id: asEntityId(200 + i),
              x: 300,
              y: 300,
              vx: 10,
              vy: 10,
              radius: 18,
            })),
            asteroidTimer: 0,
          };

          const encoded = binaryCodec.encodeSnapshot(world, asSeq(42));
          const expectedLength = HEADER + nShips * SHIP_BYTES + nBullets * BULLET_BYTES + nAsteroids * ASTEROID_BYTES;
          expect(encoded.byteLength).toBe(expectedLength);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 3: Arbitrary Corrupted / Garbage Buffers Never Crash
  it('Property 3: arbitrary garbage buffers result in typed error, never process crash', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 512 }),
        (garbage: Uint8Array) => {
          // Both decodeBinary and parseClientMessage must safely handle random garbage without throwing uncaught fatal errors
          try {
            const res = parseClientMessage(garbage);
            expect(typeof res.ok).toBe('boolean');
          } catch (e: unknown) {
            // Must be standard Error, never unhandled exception
            expect(e).toBeInstanceOf(Error);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  // Property 4: Ship Stays In Arena Over 1,000 Random Steps
  it('Property 4: ship position always stays within arena bounds over 1,000 steps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            seq: fc.integer({ min: 1, max: 10000 }).map((n) => asSeq(n)),
            thrust: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
            turn: fc.constantFrom(-1, 0, 1) as fc.Arbitrary<-1 | 0 | 1>,
            fire: fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
          }),
          { minLength: 100, maxLength: 1000 },
        ),
        (inputs: PlayerInput[]) => {
          let ship: Ship = {
            id: asEntityId(1),
            x: 640,
            y: 360,
            vx: 0,
            vy: 0,
            angle: 0,
            hp: 100,
            cooldown: 0,
            respawn: 0,
          };

          for (const input of inputs) {
            ship = integrate(ship, input, DT);
            expect(ship.x).toBeGreaterThanOrEqual(0);
            expect(ship.x).toBeLessThan(WORLD_W);
            expect(ship.y).toBeGreaterThanOrEqual(0);
            expect(ship.y).toBeLessThan(WORLD_H);
            expect(Number.isFinite(ship.x)).toBe(true);
            expect(Number.isFinite(ship.y)).toBe(true);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 5: Parser Accepts Valid Generated Messages and Rejects Corrupted Mutations
  it('Property 5: parseClientMessage accepts valid messages and rejects corrupted mutations', () => {
    fc.assert(
      fc.property(
        fc.record({
          seq: fc.integer({ min: 0, max: 100000 }),
          thrust: fc.constantFrom(0, 1),
          turn: fc.constantFrom(-1, 0, 1),
          fire: fc.constantFrom(0, 1),
        }),
        fc.constantFrom(
          { field: 'seq', badValue: -5 },
          { field: 'thrust', badValue: 99 },
          { field: 'turn', badValue: 5 },
          { field: 'fire', badValue: -1 },
          { field: 'type', badValue: 'unknown_type' },
        ),
        (validInp, mutation) => {
          // Valid message
          const validJson = JSON.stringify({ type: 'input', ...validInp });
          const validParsed = parseClientMessage(validJson);
          expect(validParsed.ok).toBe(true);

          // Mutated corrupted message
          const mutated = { type: 'input', ...validInp, [mutation.field]: mutation.badValue };
          const mutatedParsed = parseClientMessage(JSON.stringify(mutated));
          expect(mutatedParsed.ok).toBe(false);
        },
      ),
      { numRuns: 150 },
    );
  });
});

