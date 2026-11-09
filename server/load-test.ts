import { performance } from 'node:perf_hooks';
import http from 'node:http';
import { setupWebSocket } from './ws.ts';
import { roomManager } from './rooms.ts';
import { WebSocket } from 'ws';
import { binaryCodec, asSeq } from 'shared';

interface TierResult {
  clients: number;
  tickP50: number;
  tickP95: number;
  tickP99: number;
  tickMax: number;
  rssMB: number;
  eluPercent: number;
  bytesPerSec: number;
  exceededBudget: boolean;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx]!;
}

async function runTier(serverPort: number, clientCount: number, durationSec: number = 8): Promise<TierResult> {
  const roomId = `load_test_${clientCount}_${Date.now()}`;
  const room = roomManager.create(roomId);
  const match = room.match;

  const sockets: WebSocket[] = [];
  const startRss = process.memoryUsage().rss;
  const eluStart = performance.eventLoopUtilization();

  // Connect N clients
  for (let i = 0; i < clientCount; i++) {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
    ws.binaryType = 'arraybuffer';
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', room: roomId, name: `LoadClient_${i + 1}` }));
        resolve();
      });
    });
    sockets.push(ws);
  }

  // Send inputs at 30Hz from each client
  let seq = 1;
  let totalBytes = 0;
  const interval = setInterval(() => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        const inp = binaryCodec.encodeInput({
          seq: asSeq(seq),
          thrust: 1,
          turn: (seq % 3) === 0 ? 1 : (seq % 3) === 1 ? -1 : 0,
          fire: (seq % 4) === 0 ? 1 : 0,
        });
        ws.send(inp);
        totalBytes += inp.byteLength;
      }
    }
    seq++;
  }, 33);

  // Collect tick durations during test
  const tickTimes: number[] = [];
  const originalTick = (match as unknown as { tick: () => void }).tick;
  (match as unknown as { tick: () => void }).tick = function (this: typeof match) {
    const t0 = performance.now();
    originalTick.call(this);
    tickTimes.push(performance.now() - t0);
  };

  await new Promise((r) => setTimeout(r, durationSec * 1000));

  clearInterval(interval);
  for (const ws of sockets) ws.close();

  const eluEnd = performance.eventLoopUtilization(eluStart);
  const endRss = process.memoryUsage().rss;

  const p50 = percentile(tickTimes, 50);
  const p95 = percentile(tickTimes, 95);
  const p99 = percentile(tickTimes, 99);
  const max = tickTimes.length > 0 ? Math.max(...tickTimes) : 0;

  return {
    clients: clientCount,
    tickP50: Math.round(p50 * 100) / 100,
    tickP95: Math.round(p95 * 100) / 100,
    tickP99: Math.round(p99 * 100) / 100,
    tickMax: Math.round(max * 100) / 100,
    rssMB: Math.round(endRss / 1024 / 1024),
    eluPercent: Math.round(eluEnd.utilization * 1000) / 10,
    bytesPerSec: Math.round(totalBytes / durationSec),
    exceededBudget: p99 > 33.33,
  };
}

export async function runLoadTest(): Promise<TierResult[]> {
  console.log('--- Starting Server Load Test (N = 8, 32, 64, 128 clients) ---');

  const server = http.createServer();
  setupWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  const results: TierResult[] = [];
  for (const n of [8, 32, 64, 128]) {
    console.log(`Running tier N = ${n}...`);
    const res = await runTier(port, n, 6);
    results.push(res);
    console.log(`  N=${n}: p50=${res.tickP50}ms, p95=${res.tickP95}ms, p99=${res.tickP99}ms, ELU=${res.eluPercent}%, RSS=${res.rssMB}MB`);
  }

  server.close();
  return results;
}

if (process.argv[1]?.includes('load-test')) {
  runLoadTest().then((results) => {
    console.log('\n### Підсумкова таблиця навантаження (Server Capacity Table):');
    console.log('| Клієнти N | Tick p50 (мс) | Tick p95 (мс) | Tick p99 (мс) | Max (мс) | ELU (%) | RSS (MB) | Throughput (B/s) | Budget <= 33ms |');
    console.log('|:---------:|:-------------:|:-------------:|:-------------:|:--------:|:-------:|:--------:|:----------------:|:--------------:|');
    for (const r of results) {
      console.log(`| ${r.clients} | ${r.tickP50} | ${r.tickP95} | ${r.tickP99} | ${r.tickMax} | ${r.eluPercent}% | ${r.rssMB} MB | ${r.bytesPerSec} | ${r.exceededBudget ? 'FAIL (>33ms)' : 'PASS'} |`);
    }
  });
}
