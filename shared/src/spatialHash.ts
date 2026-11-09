/**
 * 2D Spatial Hash Grid for fast O(1) broadphase collision queries.
 * Divides the world into uniform grid cells to avoid O(N^2) pairwise checks.
 */
export interface SpatialItem {
  id: number;
  x: number;
  y: number;
  radius?: number;
}

export class SpatialHash<T extends SpatialItem> {
  readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly cells: Map<number, T[]> = new Map();

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  private hash(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const radius = item.radius ?? 0;
    const minCx = Math.floor((item.x - radius) * this.invCellSize);
    const maxCx = Math.floor((item.x + radius) * this.invCellSize);
    const minCy = Math.floor((item.y - radius) * this.invCellSize);
    const maxCy = Math.floor((item.y + radius) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hash(cx, cy);
        let list = this.cells.get(key);
        if (!list) {
          list = [];
          this.cells.set(key, list);
        }
        list.push(item);
      }
    }
  }

  queryRadius(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCy = Math.floor((y - radius) * this.invCellSize);
    const maxCy = Math.floor((y + radius) * this.invCellSize);

    const rSq = radius * radius;
    const seen = new Set<number>();
    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hash(cx, cy);
        const list = this.cells.get(key);
        if (!list) continue;
        for (const item of list) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          const effectiveR = radius + (item.radius ?? 0);
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= effectiveR * effectiveR) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }
}

