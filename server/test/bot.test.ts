import { describe, it, expect } from 'vitest';
import { Bot } from '../bot.ts';
import { createWorld, addShip, asSeq } from 'shared';

describe('Server Bot AI', () => {
  it('creates bot with human-compatible player interface', () => {
    const bot = new Bot('Bot_Test');
    expect(bot.name).toBe('Bot_Test');
    expect(bot.isBot).toBe(true);
    expect(bot.queue).toEqual([]);
    expect(bot.socket.readyState).toBe(1);
  });

  it('generates input with human interface {seq, thrust, turn, fire}', () => {
    const bot = new Bot('Bot_1');
    const world = createWorld(123);
    const ship = addShip(world);
    bot.id = ship.id;

    // Add opponent ship
    const opponent = addShip(world);
    opponent.x = ship.x + 100;
    opponent.y = ship.y;

    bot.think(world);

    expect(bot.queue.length).toBe(1);
    const inp = bot.queue[0]!;
    expect(inp.seq).toBe(asSeq(1));
    expect([0, 1]).toContain(inp.thrust);
    expect([-1, 0, 1]).toContain(inp.turn);
    expect([0, 1]).toContain(inp.fire);
  });

  it('turns toward opponent ship and thrusts when facing it', () => {
    const bot = new Bot('Bot_Chaser');
    const world = createWorld(999);
    const ship = addShip(world);
    bot.id = ship.id;
    ship.x = 200;
    ship.y = 200;
    ship.angle = 0; // facing right

    const opponent = addShip(world);
    opponent.x = 200;
    opponent.y = 400; // directly below (angle = +PI/2)

    bot.think(world);
    const inp = bot.queue[0]!;
    expect(inp.turn).toBe(1); // must turn right (positive angle) towards opponent
  });

  it('does not generate input if ship is in respawn state', () => {
    const bot = new Bot('Bot_Dead');
    const world = createWorld(1);
    const ship = addShip(world);
    bot.id = ship.id;
    ship.respawn = 60; // Dead / respawning

    bot.think(world);
    expect(bot.queue.length).toBe(0);
  });
});
