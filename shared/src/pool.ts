/**
 * Robert Nystrom Object Pool pattern.
 * Pre-allocates objects to avoid dynamic allocations during game loop.
 */
export class ObjectPool<T> {
  private readonly items: T[];
  private readonly freeList: number[];
  private readonly resetFn: (item: T) => void;

  constructor(
    factory: () => T,
    reset: (item: T) => void,
    initialCapacity: number = 256,
  ) {
    this.resetFn = reset;
    this.items = new Array(initialCapacity);
    this.freeList = new Array(initialCapacity);
    for (let i = 0; i < initialCapacity; i++) {
      this.items[i] = factory();
      this.freeList[i] = i;
    }
  }

  get capacity(): number {
    return this.items.length;
  }

  get available(): number {
    return this.freeList.length;
  }

  get activeCount(): number {
    return this.items.length - this.freeList.length;
  }

  acquire(): T | null {
    if (this.freeList.length === 0) {
      return null;
    }
    const index = this.freeList.pop()!;
    const item = this.items[index]!;
    this.resetFn(item);
    return item;
  }

  release(item: T): boolean {
    const index = this.items.indexOf(item);
    if (index === -1) return false;
    if (this.freeList.includes(index)) return false; // Already released
    this.resetFn(item);
    this.freeList.push(index);
    return true;
  }

  releaseAll(): void {
    this.freeList.length = 0;
    for (let i = 0; i < this.items.length; i++) {
      this.resetFn(this.items[i]!);
      this.freeList.push(i);
    }
  }
}
