// Low-poly builders in a handful of shared materials: cream walls, terracotta
// roofs, dark green shutters, warm windows, sage canopies, warm wood.

import * as THREE from 'three'

export interface Collider {
  x: number
  z: number
  r: number
}

export const PALETTE = {
  wall: 0xece4d0,
  wallShade: 0xd9cdb4,
  roof: 0xd4835a,
  ridge: 0xb96a48,
  shutter: 0x3f5a45,
  window: 0xffd27a,
  wood: 0xb98a5a,
  darkWood: 0x6b4a2b,
  stone: 0xdcd6d3,
  canopy: 0x8fb36a,
  canopyLight: 0xa8c47a,
  pine: 0x4d7a58,
  cypress: 0x3a5f44,
  bronze: 0xb08a3a,
  tram: 0x2f4a3a,
  trim: 0xe8dcc4,
}

const materials = new Map<number, THREE.MeshLambertMaterial>()
export function mat(color: number) {
  let m = materials.get(color)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color })
    materials.set(color, m)
  }
  return m
}

const glow = new THREE.MeshLambertMaterial({ color: PALETTE.window, emissive: PALETTE.window, emissiveIntensity: 0.7 })

export function box(w: number, h: number, d: number, color: number, y = h / 2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  m.position.y = y
  m.castShadow = true
  return m
}

export function cone(r: number, h: number, color: number, y: number, sides = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), mat(color))
  m.position.y = y
  m.castShadow = true
  return m
}

export function cylinder(r: number, h: number, color: number, y: number, sides = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, sides), mat(color))
  m.position.y = y
  m.castShadow = true
  return m
}

function windowWithShutters(g: THREE.Group, x: number, z: number, rotY: number) {
  const w = new THREE.Group()
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.08), glow)
  pane.position.y = 1.7
  w.add(pane)
  for (const side of [-1, 1]) {
    const shutter = box(0.3, 0.85, 0.06, PALETTE.shutter, 1.7)
    shutter.position.x = side * 0.55
    w.add(shutter)
  }
  w.position.set(x, 0, z)
  w.rotation.y = rotY
  g.add(w)
}

export function house(scale = 1) {
  const g = new THREE.Group()
  g.add(box(4.4, 3.2, 3.8, PALETTE.wall))
  const roof = cone(3.6, 2.2, PALETTE.roof, 4.3, 4)
  roof.rotation.y = Math.PI / 4
  roof.scale.z = 0.9
  g.add(roof)
  g.add(box(3.2, 0.14, 0.3, PALETTE.ridge, 5.35))
  const chimney = box(0.5, 1.2, 0.5, PALETTE.wallShade, 4.6)
  chimney.position.set(1.3, 4.6, -0.8)
  g.add(chimney)
  windowWithShutters(g, 0, 1.94, 0)
  windowWithShutters(g, 2.24, 0, Math.PI / 2)
  g.scale.setScalar(scale)
  return g
}

export function roundTree(light = false) {
  const g = new THREE.Group()
  g.add(cylinder(0.3, 1.6, PALETTE.darkWood, 0.8))
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), mat(light ? PALETTE.canopyLight : PALETTE.canopy))
  crown.position.y = 2.6
  crown.scale.y = 0.85
  crown.castShadow = true
  g.add(crown)
  return g
}

export const olive = () => roundTree(false)

export function cypress() {
  const g = new THREE.Group()
  g.add(cylinder(0.2, 1, PALETTE.darkWood, 0.5))
  g.add(cone(1, 6, PALETTE.cypress, 3.8, 6))
  return g
}

export function pine() {
  const g = new THREE.Group()
  g.add(cylinder(0.25, 2, PALETTE.darkWood, 1))
  g.add(cone(1.6, 3, PALETTE.pine, 3))
  g.add(cone(1.2, 2.5, PALETTE.pine, 4.8))
  return g
}

export function column(h = 4) {
  const g = new THREE.Group()
  g.add(cylinder(0.45, h, PALETTE.stone, h / 2, 10))
  g.add(box(1.3, 0.3, 1.3, PALETTE.stone, h + 0.15))
  return g
}

export function tripod() {
  const g = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const leg = cylinder(0.08, 1.6, PALETTE.bronze, 0.8, 5)
    leg.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.4, 0.8, Math.sin((i * Math.PI * 2) / 3) * 0.4)
    g.add(leg)
  }
  g.add(cylinder(0.6, 0.3, PALETTE.bronze, 1.7, 8))
  return g
}

export function terrace(w: number, d: number, h: number) {
  return box(w, h, d, PALETTE.stone)
}

export function pier() {
  const g = new THREE.Group()
  g.add(box(3, 0.4, 14, PALETTE.wood, 0.6))
  for (let i = -1; i <= 1; i++) {
    const leg = cylinder(0.2, 2, PALETTE.darkWood, 0, 5)
    leg.position.set(1.6, 0, i * 6)
    g.add(leg)
  }
  return g
}

export function workshop() {
  const g = new THREE.Group()
  g.add(box(9, 4, 7, PALETTE.wallShade))
  g.add(box(9.4, 0.6, 7.4, PALETTE.ridge, 4.3))
  const wing = box(0.1, 2.2, 5, PALETTE.trim, 6)
  wing.rotation.z = 0.5
  wing.position.x = 2
  g.add(wing)
  windowWithShutters(g, 0, 3.54, 0)
  return g
}

export function lighthouse() {
  const g = new THREE.Group()
  g.add(cylinder(1.2, 9, PALETTE.wall, 4.5, 10))
  g.add(cylinder(1.5, 0.4, PALETTE.shutter, 9.2, 10))
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 8), glow)
  lamp.position.y = 10
  g.add(lamp)
  g.add(cone(1.3, 1.2, PALETTE.shutter, 11.2, 8))
  return g
}

export function lampPost(withLight: boolean) {
  const g = new THREE.Group()
  g.add(cylinder(0.08, 3.2, PALETTE.darkWood, 1.6, 5))
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), glow)
  lantern.position.y = 3.4
  g.add(lantern)
  if (withLight) {
    const light = new THREE.PointLight(PALETTE.window, 8, 12)
    light.position.y = 3.4
    g.add(light)
  }
  return g
}

export function memoryMesh() {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0xfff1b8, emissive: 0xffc25a, emissiveIntensity: 0.9 }),
  )
  m.add(new THREE.PointLight(0xffc25a, 12, 14))
  return m
}
