/** Allocation-free linked buckets. Exact cell checks reject hash collisions. */
export class SpatialHash {
  private readonly mask = 8191;
  private heads = new Int32Array(this.mask + 1);
  private next: Int32Array;
  private cx: Int32Array;
  private cy: Int32Array;
  private cz: Int32Array;
  cellSize = 10;

  constructor(capacity: number) {
    this.next = new Int32Array(capacity);
    this.cx = new Int32Array(capacity);
    this.cy = new Int32Array(capacity);
    this.cz = new Int32Array(capacity);
  }
  private key(x: number, y: number, z: number): number {
    return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & this.mask;
  }
  build(positions: Float32Array, count: number, cellSize: number, alive?: Uint8Array): void {
    this.cellSize = Math.max(0.1, cellSize);
    this.heads.fill(-1);
    for (let i = 0; i < count; i++) {
      if (alive && !alive[i]) continue;
      const x = Math.floor(positions[i * 3] / this.cellSize);
      const y = Math.floor(positions[i * 3 + 1] / this.cellSize);
      const z = Math.floor(positions[i * 3 + 2] / this.cellSize);
      this.cx[i] = x; this.cy[i] = y; this.cz[i] = z;
      const key = this.key(x, y, z);
      this.next[i] = this.heads[key]; this.heads[key] = i;
    }
  }
  /** Cells outside the query sphere are skipped; the caller filters individual fish. */
  query(x: number, y: number, z: number, result: Int32Array, radius = this.cellSize): number {
    const size = this.cellSize, r2 = radius * radius;
    const minX = Math.floor((x - radius) / size), maxX = Math.floor((x + radius) / size);
    const minY = Math.floor((y - radius) / size), maxY = Math.floor((y + radius) / size);
    const minZ = Math.floor((z - radius) / size), maxZ = Math.floor((z + radius) / size);
    let count = 0;
    for (let xx = minX; xx <= maxX; xx++) for (let yy = minY; yy <= maxY; yy++) for (let zz = minZ; zz <= maxZ; zz++) {
      const dx = Math.max(xx * size - x, 0, x - (xx + 1) * size);
      const dy = Math.max(yy * size - y, 0, y - (yy + 1) * size);
      const dz = Math.max(zz * size - z, 0, z - (zz + 1) * size);
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      for (let i = this.heads[this.key(xx, yy, zz)]; i !== -1; i = this.next[i]) {
        if (this.cx[i] === xx && this.cy[i] === yy && this.cz[i] === zz) result[count++] = i;
      }
    }
    return count;
  }
}
