export const radians = Math.PI / 180;
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export function randomGenerator(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit-vector rotation, with a defined axis even for exactly opposite vectors. */
export function turnToward(out: Float32Array, i: number, x: number, y: number, z: number,
  tx: number, ty: number, tz: number, maxAngle: number): void {
  const currentLength = Math.sqrt(x * x + y * y + z * z) || 1;
  x /= currentLength; y /= currentLength; z /= currentLength;
  const len = Math.hypot(tx, ty, tz);
  if (len < 1e-8) { out[i] = x; out[i + 1] = y; out[i + 2] = z; return; }
  tx /= len; ty /= len; tz /= len;
  const dot = clamp(x * tx + y * ty + z * tz, -1, 1);
  const angle = Math.acos(dot);
  if (angle <= maxAngle || angle < 1e-6) {
    out[i] = tx; out[i + 1] = ty; out[i + 2] = tz; return;
  }
  let px = tx - dot * x, py = ty - dot * y, pz = tz - dot * z;
  let plen = Math.hypot(px, py, pz);
  if (plen < 1e-6) {
    if (Math.abs(y) < 0.9) { px = -z; py = 0; pz = x; }
    else { px = 0; py = z; pz = -y; }
    plen = Math.hypot(px, py, pz);
  }
  const c = Math.cos(maxAngle), s = Math.sin(maxAngle) / plen;
  const ox = x * c + px * s, oy = y * c + py * s, oz = z * c + pz * s;
  const outputLength = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  out[i] = ox / outputLength; out[i + 1] = oy / outputLength; out[i + 2] = oz / outputLength;
}
