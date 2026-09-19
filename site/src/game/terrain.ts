// The landscape as a function: heightAt(x, z) is the truth, the mesh is a
// sampling of it, and every other system asks the function, not the mesh.

import * as THREE from 'three'
import { clamp, distToSegment, fbm, lerp, smoothstep } from './noise.ts'
import { BLOBS, ISTHMUS, POOLS, REGIONS, RIVERS } from './regions.ts'

export const WORLD = 480
const HALF = WORLD / 2
const SEGMENTS = 160
const CHANNEL_WIDTH = 7
const CHANNEL_DEPTH = 5

function landBase(x: number, z: number) {
  let base = 0
  for (const b of BLOBS) {
    const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r)
    if (d2 < 1) base += b.h * (1 - d2)
  }
  return base
}

function carve(x: number, z: number) {
  let depth = 0
  for (const line of Object.values(RIVERS)) {
    for (let i = 1; i < line.length; i++) {
      const d = distToSegment(x, z, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1])
      depth = Math.max(depth, 1 - d / CHANNEL_WIDTH)
    }
  }
  for (const p of POOLS) depth = Math.max(depth, 1 - Math.hypot(x - p.x, z - p.z) / (p.r + 2))
  return CHANNEL_DEPTH * clamp(depth, 0, 1)
}

function isthmus(x: number, z: number) {
  const side = smoothstep(ISTHMUS.halfWidth, ISTHMUS.halfWidth + 14, Math.abs(x))
  const band = smoothstep(ISTHMUS.z0 - 10, ISTHMUS.z0, z) * (1 - smoothstep(ISTHMUS.z1, ISTHMUS.z1 + 10, z))
  return ISTHMUS.depth * side * band
}

// The strait that makes Crete an island; it is still a short flight or swim.
function strait(x: number, z: number) {
  const band = smoothstep(112, 120, z) * (1 - smoothstep(130, 138, z))
  return 14 * band * (1 - smoothstep(70, 90, Math.abs(x)))
}

export function heightAt(x: number, z: number) {
  const base = landBase(x, z)
  const relief = base * (0.75 + 0.5 * fbm(x * 0.02, z * 0.02))
  const detail = 2.5 * fbm(x * 0.08, z * 0.08, 3) - 3.5
  return relief + detail - carve(x, z) - isthmus(x, z) - strait(x, z)
}

for (const p of POOLS) p.y = heightAt(p.x, p.z) + 1.2

export function poolAt(x: number, z: number) {
  return POOLS.find((p) => Math.hypot(x - p.x, z - p.z) < p.r) ?? null
}

// Water surface height at a point, or null on dry land.
export function waterAt(x: number, z: number): number | null {
  const pool = poolAt(x, z)
  if (pool) return pool.y ?? 0
  return heightAt(x, z) < 0.4 ? 0 : null
}

export function regionAt(x: number, z: number) {
  let best = REGIONS[0]
  let bestD = Number.POSITIVE_INFINITY
  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z) / r.r
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return bestD < 1.6 ? best : null
}

// Flat ground is meadow whatever its height; steep faces are lavender rock,
// the highest of them limestone. Sand only at the shore.
function colorAt(x: number, z: number, h: number, out: THREE.Color) {
  const n = fbm(x * 0.05, z * 0.05, 2)
  const slope = Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5
  if (h < 0.4) out.setHex(0xe6d5b0)
  else {
    out.setHex(h < 10 ? 0xa9c489 : 0x8fae74)
    const rock = new THREE.Color(h > 45 ? 0xdcd6d3 : 0x948fa3)
    out.lerp(rock, smoothstep(0.45, 1.0, slope))
    const region = regionAt(x, z)
    if (region) out.lerp(new THREE.Color(region.tint), 0.18)
  }
  out.offsetHSL(0, 0, (n - 0.5) * 0.08)
}

function fillTerrain(pos: number[], col: number[]) {
  const step = WORLD / SEGMENTS
  const c = new THREE.Color()
  const push = (i: number, j: number) => {
    const x = -HALF + i * step
    const z = -HALF + j * step
    const h = heightAt(x, z)
    pos.push(x, h, z)
    colorAt(x, z, h, c)
    col.push(c.r, c.g, c.b)
  }
  for (let j = 0; j < SEGMENTS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      push(i, j)
      push(i, j + 1)
      push(i + 1, j)
      push(i + 1, j)
      push(i, j + 1)
      push(i + 1, j + 1)
    }
  }
}

// Non-indexed so every triangle keeps its own flat normal: the low-poly look.
export function buildTerrain() {
  const pos: number[] = []
  const col: number[] = []
  fillTerrain(pos, col)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  mesh.receiveShadow = true
  return mesh
}

export function buildWater() {
  const group = new THREE.Group()
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 4, WORLD * 4),
    new THREE.MeshPhongMaterial({ color: 0x8fd0d4, transparent: true, opacity: 0.9, shininess: 90, specular: 0xffffff }),
  )
  sea.rotation.x = -Math.PI / 2
  group.add(sea)
  const fresh = new THREE.MeshPhongMaterial({ color: 0x9fe0e4, transparent: true, opacity: 0.85, emissive: 0x0f4048 })
  for (const p of POOLS) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r + 1.5, 18), fresh)
    disc.rotation.x = -Math.PI / 2
    disc.position.set(p.x, (p.y ?? 0) + 0.02, p.z)
    group.add(disc)
  }
  return group
}

// Top-down raster for the map overlay, land colours by height.
export function mapImage(size: number) {
  const data = new Uint8ClampedArray(size * size * 4)
  const c = new THREE.Color()
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = lerp(-HALF, HALF, i / (size - 1))
      const z = lerp(-HALF, HALF, j / (size - 1))
      const h = heightAt(x, z)
      if (h < 0.4) c.setHex(0x7fc4c8)
      else colorAt(x, z, h, c)
      const k = (j * size + i) * 4
      data[k] = c.r * 255
      data[k + 1] = c.g * 255
      data[k + 2] = c.b * 255
      data[k + 3] = 255
    }
  }
  return new ImageData(data, size, size)
}

export const toMap = (v: number, size: number) => ((v + HALF) / WORLD) * size
