import { describe, it, expect } from 'vitest';
import {
  createWorld, addShip, stepWorld, integrate, didFire, makeBullet, stepBullet,
  normalizeAngle, hashWorld, sanitizeInput,
  WORLD_W, WORLD_H, SHIP_RADIUS, BULLET_RADIUS, BULLET_DAMAGE, ASTEROID_DAMAGE, DT,
  asEntityId, asSeq, asTick, type Ship, type PlayerInput, type World,
} from '../src';

describe('Simulation & Physics Unit Tests', () => {
  const dummyShip = (): Ship => ({
    id: asEntityId(1),
    x: 500,
    y: 300,
    vx: 0,
    vy: 0,
    angle: 0,
    hp: 100,
    cooldown: 0,
    respawn: 0,
  });

  describe('integrate', () => {
    it('accelerates forward when thrust is 1', () => {
      const s = dummyShip();
      const inp: PlayerInput = { seq: asSeq(1), thrust: 1, turn: 0, fire: 0 };
      const next = integrate(s, inp, DT);

      // Facing angle 0 (positive X)
      expect(next.vx).toBeGreaterThan(0);
      expect(next.vy).toBe(0);
      expect(next.x).toBeGreaterThan(s.x);
    });

    it('rotates when turn is non-zero', () => {
      const s = dummyShip();
      const inpTurnRight: PlayerInput = { seq: asSeq(1), thrust: 0, turn: 1, fire: 0 };
      const nextRight = integrate(s, inpTurnRight, DT);
      expect(nextRight.angle).toBeGreaterThan(0);

      const inpTurnLeft: PlayerInput = { seq: asSeq(2), thrust: 0, turn: -1, fire: 0 };
      const nextLeft = integrate(s, inpTurnLeft, DT);
      expect(nextLeft.angle).toBeLessThan(0);
    });

    it('applies aerodynamic drag on velocity', () => {
      const s = dummyShip();
      s.vx = 100;
      s.vy = 100;
      const inp: PlayerInput = { seq: asSeq(1), thrust: 0, turn: 0, fire: 0 };
      const next = integrate(s, inp, DT);
      expect(next.vx).toBeLessThan(100);
      expect(next.vy).toBeLessThan(100);
    });

    it('wraps coordinates around world boundaries', () => {
      const s = dummyShip();
      s.x = WORLD_W - 1;
      s.vx = 100;
      const inp: PlayerInput = { seq: asSeq(1), thrust: 0, turn: 0, fire: 0 };
      const next = integrate(s, inp, DT);
      expect(next.x).toBeLessThan(WORLD_W);
      expect(next.x).toBeGreaterThanOrEqual(0);
    });

    it('does not move or rotate ship during respawn state', () => {
      const s = dummyShip();
      s.respawn = 30;
      s.x = 200;
      const inp: PlayerInput = { seq: asSeq(1), thrust: 1, turn: 1, fire: 1 };
      const next = integrate(s, inp, DT);
      expect(next.x).toBe(200);
      expect(next.angle).toBe(0);
    });

    it('sets cooldown when ship fires', () => {
      const s = dummyShip();
      const inp: PlayerInput = { seq: asSeq(1), thrust: 0, turn: 0, fire: 1 };
      const next = integrate(s, inp, DT);
      expect(next.cooldown).toBeGreaterThan(0);
    });
  });

  describe('Collision Detection Cases', () => {
    it('detects overlapping collision between bullet and ship', () => {
      const world: World = {
        tick: asTick(0),
        rng: 1,
        nextId: 10,
        ships: [dummyShip()],
        bullets: [{
          id: asEntityId(2),
          owner: asEntityId(99), // different owner
          seq: asSeq(1),
          x: 500, // exact same center -> overlapping
          y: 300,
          vx: 0,
          vy: 0,
          ttl: 10,
        }],
        asteroids: [],
        asteroidTimer: 0,
      };

      stepWorld(world, {});
      expect(world.bullets.length).toBe(0); // Bullet consumed
      expect(world.ships[0]?.hp).toBe(100 - BULLET_DAMAGE); // Ship damaged
    });

    it('detects touching collision exactly at boundary (r1 + r2)', () => {
      const ship = dummyShip();
      const touchDistance = SHIP_RADIUS + BULLET_RADIUS - 0.5; // Touching
      const world: World = {
        tick: asTick(0),
        rng: 1,
        nextId: 10,
        ships: [ship],
        bullets: [{
          id: asEntityId(2),
          owner: asEntityId(99),
          seq: asSeq(1),
          x: ship.x + touchDistance,
          y: ship.y,
          vx: 0,
          vy: 0,
          ttl: 10,
        }],
        asteroids: [],
        asteroidTimer: 0,
      };

      stepWorld(world, {});
      expect(world.bullets.length).toBe(0);
      expect(world.ships[0]?.hp).toBe(100 - BULLET_DAMAGE);
    });

    it('reports missing when bullet misses the target radius', () => {
      const ship = dummyShip();
      const missDistance = SHIP_RADIUS + BULLET_RADIUS + 5; // Farther than radius sum
      const world: World = {
        tick: asTick(0),
        rng: 1,
        nextId: 10,
        ships: [ship],
        bullets: [{
          id: asEntityId(2),
          owner: asEntityId(99),
          seq: asSeq(1),
          x: ship.x + missDistance,
          y: ship.y,
          vx: 0,
          vy: 0,
          ttl: 10,
        }],
        asteroids: [],
        asteroidTimer: 0,
      };

      stepWorld(world, {});
      expect(world.bullets.length).toBe(1); // Bullet alive
      expect(world.ships[0]?.hp).toBe(100); // No damage
    });

    it('documents discrete tunneling behavior for ultra-fast bullets without CCD', () => {
      const ship = dummyShip();
      // Bullet traveling at 50,000 px/s in single dt (dt=1/30 -> step is 1666 px)
      // Jumps completely over the ship from -800 to +800
      const world: World = {
        tick: asTick(0),
        rng: 1,
        nextId: 10,
        ships: [ship],
        bullets: [{
          id: asEntityId(2),
          owner: asEntityId(99),
          seq: asSeq(1),
          x: ship.x - 200,
          y: ship.y,
          vx: 20000,
          vy: 0,
          ttl: 10,
        }],
        asteroids: [],
        asteroidTimer: 0,
      };

      stepWorld(world, {});
      // In discrete collision detection, bullet tunnels past ship without intersecting at discrete sample
      expect(world.ships[0]?.hp).toBe(100);
    });

    it('handles asteroid vs ship collision and destroys asteroid while damaging ship', () => {
      const ship = dummyShip();
      const world: World = {
        tick: asTick(0),
        rng: 1,
        nextId: 10,
        ships: [ship],
        bullets: [],
        asteroids: [{
          id: asEntityId(3),
          x: ship.x,
          y: ship.y,
          vx: 0,
          vy: 0,
          radius: 20,
        }],
        asteroidTimer: 0,
      };

      stepWorld(world, {});
      expect(world.asteroids.length).toBe(0);
      expect(world.ships[0]?.hp).toBe(100 - ASTEROID_DAMAGE);
    });
  });

  describe('World.step Determinism', () => {
    it('produces identical state when stepped from identical cloned state with identical inputs', () => {
      const worldA = createWorld(42);
      addShip(worldA);
      addShip(worldA);

      // Deep clone worldA into worldB
      const worldB = JSON.parse(JSON.stringify(worldA)) as World;

      const inputs = {
        [worldA.ships[0]!.id]: { seq: asSeq(1), thrust: 1 as const, turn: 1 as const, fire: 1 as const },
        [worldA.ships[1]!.id]: { seq: asSeq(1), thrust: 0 as const, turn: -1 as const, fire: 0 as const },
      };

      for (let step = 0; step < 10; step++) {
        stepWorld(worldA, inputs);
        stepWorld(worldB, inputs);
      }

      expect(hashWorld(worldA)).toBe(hashWorld(worldB));
      expect(worldA).toEqual(worldB);
    });
  });

  describe('Input Sanitization', () => {
    it('accepts strictly valid inputs', () => {
      expect(sanitizeInput({ seq: 10, thrust: 1, turn: -1, fire: 0 })).toEqual({
        seq: asSeq(10),
        thrust: 1,
        turn: -1,
        fire: 0,
      });
    });

    it('rejects cheated / corrupted fields', () => {
      expect(sanitizeInput(null)).toBeNull();
      expect(sanitizeInput({ seq: -1, thrust: 1, turn: 0, fire: 0 })).toBeNull();
      expect(sanitizeInput({ seq: 1, thrust: 2, turn: 0, fire: 0 })).toBeNull();
      expect(sanitizeInput({ seq: 1, thrust: 1, turn: 999, fire: 0 })).toBeNull();
      expect(sanitizeInput({ seq: 1.5, thrust: 1, turn: 0, fire: 0 })).toBeNull();
    });
  });
});

