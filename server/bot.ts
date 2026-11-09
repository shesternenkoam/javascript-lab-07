import {
  asEntityId, asSeq, normalizeAngle,
  type EntityId, type PlayerInput, type World, type BinaryFlag, type TurnDirection,
} from 'shared';
import type { Player } from './rooms.ts';
import { LinkSim } from './netsim.ts';
import type { WebSocket } from 'ws';

export class Bot implements Player {
  id: EntityId = asEntityId(0);
  name: string;
  socket: WebSocket;
  link: LinkSim;
  codec: 'json' | 'binary' = 'binary';
  queue: PlayerInput[] = [];
  lastSeq: number = 0;
  ack: number = 0;
  bytesIn: number = 0;
  bytesOut: number = 0;
  readonly isBot: boolean = true;

  constructor(name: string) {
    this.name = name;
    this.link = new LinkSim();
    this.socket = {
      readyState: 1, // OPEN
      send: () => {},
      close: () => {},
      bufferedAmount: 0,
    } as unknown as WebSocket;
  }

  sendJson(_msg: unknown): void {}
  sendRaw(_data: string | Uint8Array): void {}

  think(world: World): void {
    const me = world.ships.find((s) => s.id === this.id);
    if (!me || me.respawn > 0) return;

    // Target closest opponent ship or asteroid
    let closestDistSq = Infinity;
    let targetX = 0;
    let targetY = 0;

    for (const s of world.ships) {
      if (s.id === this.id || s.respawn > 0) continue;
      const dx = s.x - me.x;
      const dy = s.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < closestDistSq) {
        closestDistSq = d2;
        targetX = s.x;
        targetY = s.y;
      }
    }

    if (closestDistSq === Infinity && world.asteroids.length > 0) {
      for (const a of world.asteroids) {
        const dx = a.x - me.x;
        const dy = a.y - me.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < closestDistSq) {
          closestDistSq = d2;
          targetX = a.x;
          targetY = a.y;
        }
      }
    }

    let thrust: BinaryFlag = 0;
    let turn: TurnDirection = 0;
    let fire: BinaryFlag = 0;

    if (closestDistSq < Infinity) {
      const angleToTarget = Math.atan2(targetY - me.y, targetX - me.x);
      const angleDiff = normalizeAngle(angleToTarget - me.angle);

      if (angleDiff > 0.08) turn = 1;
      else if (angleDiff < -0.08) turn = -1;

      if (Math.abs(angleDiff) < 0.6) thrust = 1;
      if (Math.abs(angleDiff) < 0.35 && closestDistSq < 450 * 450) fire = 1;
    }

    this.lastSeq += 1;
    const input: PlayerInput = {
      seq: asSeq(this.lastSeq),
      thrust,
      turn,
      fire,
    };
    this.queue.push(input);
  }
}
