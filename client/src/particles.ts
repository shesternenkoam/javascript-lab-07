import { ObjectPool } from 'shared';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export class ParticleSystem {
  readonly pool: ObjectPool<Particle>;
  readonly activeParticles: Particle[] = [];

  constructor(capacity: number = 500) {
    this.pool = new ObjectPool<Particle>(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#ff9800' }),
      (p) => {
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.life = 0;
        p.maxLife = 1;
        p.color = '#ff9800';
      },
      capacity,
    );
  }

  emit(x: number, y: number, count: number = 8, color: string = '#ff9800'): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) break; // Pool exhausted, skip gracefully without allocating
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 80;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.2 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.color = color;
      this.activeParticles.push(p);
    }
  }

  update(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.release(p);
        this.activeParticles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.activeParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}
