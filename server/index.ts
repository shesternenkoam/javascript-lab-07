import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { config } from './config.ts';
import { roomManager } from './rooms.ts';
import { setupWebSocket } from './ws.ts';

const RoomBodySchema = z.object({ name: z.string().min(1) });

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`[Metrics] RSS пам'ять: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
}, 5000);

const server = http.createServer((req, res) => {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const memory = process.memoryUsage();
    const elu = performance.eventLoopUtilization();
    res.end(JSON.stringify({
      rooms: roomManager.stats(),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
      elu,
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(roomManager.list()));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 1e6) req.socket.destroy();
    });

    req.on('end', () => {
      try {
        const parsed = RoomBodySchema.safeParse(JSON.parse(body));
        if (!parsed.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Room name is required' }));
          return;
        }
        roomManager.create(parsed.data.name);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: parsed.data.name }));
      } catch (_err: unknown) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  const botsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/bots$/);
  if (req.method === 'POST' && botsMatch) {
    const roomId = decodeURIComponent(botsMatch[1]!);
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 1e6) req.socket.destroy();
    });

    req.on('end', () => {
      try {
        const parsed = z
          .object({ count: z.number().int().positive().default(8) })
          .safeParse(body ? JSON.parse(body) : { count: 8 });
        const count = parsed.success ? parsed.data.count : 8;
        const room = roomManager.get(roomId) ?? roomManager.create(roomId);
        const added = room.match.addBots(count);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, added: added.length, total: room.match.world.ships.length }));
      } catch (_err: unknown) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to add bots' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

setupWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(`Server is running on http://${config.host}:${config.port}`);
});

const shutdown = (): void => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
