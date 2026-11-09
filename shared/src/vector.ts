/**
 * Fast 2D Vector with allocation-free in-place math for game simulation and rendering loops.
 */
export class Vector2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  static create(x: number = 0, y: number = 0): Vector2 {
    return new Vector2(x, y);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other: { x: number; y: number }): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(other: { x: number; y: number }): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  sub(other: { x: number; y: number }): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  addScaled(other: { x: number; y: number }, scale: number): this {
    this.x += other.x * scale;
    this.y += other.y * scale;
    return this;
  }

  dot(other: { x: number; y: number }): number {
    return this.x * other.x + this.y * other.y;
  }

  lenSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  len(): number {
    return Math.hypot(this.x, this.y);
  }

  distSq(other: { x: number; y: number }): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  dist(other: { x: number; y: number }): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  normalize(): this {
    const l = this.len();
    if (l > 1e-6) {
      this.x /= l;
      this.y /= l;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  zero(): this {
    this.x = 0;
    this.y = 0;
    return this;
  }
}

// Global scratch vectors to completely avoid allocating temporary Vector2 in tight loops
export const scratchVec1 = new Vector2();
export const scratchVec2 = new Vector2();
