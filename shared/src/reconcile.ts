import { DT, WORLD_W, WORLD_H } from './constants.ts';
import { integrate, normalizeAngle } from './sim.ts';
import type { EntityId, PlayerInput, Ship, Snapshot } from './types.ts';

const SNAP_DISTANCE = 120;

export const wrapDelta = (d: number, size: number): number =>
  d > size / 2 ? d - size : d < -size / 2 ? d + size : d;

export interface ReconcileResult {
  replayedShip: Ship;
  remainingInputs: PlayerInput[];
  correction: number;
  offsetDelta: { x: number; y: number; angle: number };
  snapped: boolean;
}

/**
 * Pure function to reconcile predicted client state against an authoritative server snapshot.
 *
 * @param currentShip Client's predicted ship before receiving snapshot
 * @param pendingInputs Input buffer currently unacknowledged by the client
 * @param snap Authoritative snapshot from server
 * @param myId Client player entity ID
 * @param dt Timestep duration
 */
export function reconcile(
  currentShip: Ship | null,
  pendingInputs: PlayerInput[],
  snap: Snapshot,
  myId: EntityId,
  dt: number = DT,
): ReconcileResult | null {
  const own = snap.ships.find((s) => s.id === myId);
  if (!own) return null;

  // Filter out acknowledged inputs
  const remainingInputs = pendingInputs.filter((i) => i.seq > snap.ack);

  // Replay unacknowledged inputs on top of authoritative server state
  let replayedShip: Ship = { ...own };
  for (const input of remainingInputs) {
    replayedShip = integrate(replayedShip, input, dt);
  }

  let correction = 0;
  let offsetDelta = { x: 0, y: 0, angle: 0 };
  let snapped = false;

  if (currentShip) {
    const dx = wrapDelta(currentShip.x - replayedShip.x, WORLD_W);
    const dy = wrapDelta(currentShip.y - replayedShip.y, WORLD_H);
    const da = normalizeAngle(currentShip.angle - replayedShip.angle);
    correction = Math.hypot(dx, dy);

    if (correction > SNAP_DISTANCE) {
      snapped = true;
      offsetDelta = { x: 0, y: 0, angle: 0 };
    } else {
      offsetDelta = { x: dx, y: dy, angle: da };
    }
  }

  return {
    replayedShip,
    remainingInputs,
    correction,
    offsetDelta,
    snapped,
  };
}
