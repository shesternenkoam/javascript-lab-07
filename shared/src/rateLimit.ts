/**
 * Token Bucket rate limiter.
 * Controls maximum burst and sustained throughput of actions (e.g. packets per second).
 */
export class TokenBucket {
  readonly capacity: number;
  readonly refillRate: number; // Tokens per second
  private tokens: number;
  private lastRefillTime: number;

  constructor(capacity: number, refillRate: number, now: number = 0) {
    if (capacity <= 0 || refillRate <= 0) {
      throw new Error('Capacity and refillRate must be strictly positive');
    }
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefillTime = now;
  }

  get availableTokens(): number {
    return this.tokens;
  }

  refill(now: number): void {
    if (now <= this.lastRefillTime) return;
    const elapsedSec = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRate);
    this.lastRefillTime = now;
  }

  consume(amount: number = 1, now: number = 0): boolean {
    if (now > 0) this.refill(now);
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }
}
