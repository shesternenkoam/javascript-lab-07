import { describe, it, expect } from 'vitest';
import { TokenBucket } from '../src/rateLimit.ts';

describe('TokenBucket rate limiter', () => {
  it('initializes with capacity full of tokens', () => {
    const bucket = new TokenBucket(10, 5, 1000);
    expect(bucket.availableTokens).toBe(10);
    expect(bucket.capacity).toBe(10);
    expect(bucket.refillRate).toBe(5);
  });

  it('rejects invalid capacity or refill rate', () => {
    expect(() => new TokenBucket(0, 5)).toThrow();
    expect(() => new TokenBucket(10, 0)).toThrow();
    expect(() => new TokenBucket(-5, -5)).toThrow();
  });

  it('allows consumption when tokens are available', () => {
    const bucket = new TokenBucket(10, 5, 1000);
    expect(bucket.consume(3, 1000)).toBe(true);
    expect(bucket.availableTokens).toBe(7);
  });

  it('denies consumption when tokens are exhausted', () => {
    const bucket = new TokenBucket(5, 1, 1000);
    expect(bucket.consume(5, 1000)).toBe(true);
    expect(bucket.availableTokens).toBe(0);
    expect(bucket.consume(1, 1000)).toBe(false);
  });

  it('refills tokens linearly over time', () => {
    const bucket = new TokenBucket(10, 5, 1000); // 5 tokens/sec
    bucket.consume(10, 1000);
    expect(bucket.availableTokens).toBe(0);

    // 1 second later -> +5 tokens
    expect(bucket.consume(5, 2000)).toBe(true);
    expect(bucket.availableTokens).toBe(0);
  });

  it('does not exceed capacity during refill', () => {
    const bucket = new TokenBucket(10, 5, 1000);
    bucket.refill(100000); // long time later
    expect(bucket.availableTokens).toBe(10);
  });

  it('handles partial token consumption and refills correctly', () => {
    const bucket = new TokenBucket(10, 10, 1000); // 10 tokens/sec = 1 token / 100ms
    bucket.consume(10, 1000);
    expect(bucket.consume(1, 1050)).toBe(false); // only 0.5 tokens refilled
    expect(bucket.consume(1, 1100)).toBe(true);  // 1 token refilled
  });
});
