// Value noise and small math helpers; everything procedural starts here.

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const fade = (t: number) => t * t * (3 - 2 * t)

export function noise2(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// 0..1, four octaves by default.
export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let f = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f + i * 17.3, y * f - i * 9.1)
    norm += amp
    amp *= 0.5
    f *= 2.1
  }
  return sum / norm
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

// Frame-rate independent smoothing: fraction of the gap closed after dt.
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz || 1
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1)
  const cx = ax + dx * t - px
  const cz = az + dz * t - pz
  return Math.hypot(cx, cz)
}

// Deterministic pseudo-random sequence for placing props.
export function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
