// Dressing each region: scattered houses and trees, the landmarks that make
// a place recognisable, lamps, shrines, memories and inhabitants.

import * as THREE from 'three'
import { NAMES } from '../names.ts'
import { seeded } from './noise.ts'
import {
  box,
  column,
  cypress,
  house,
  lampPost,
  lighthouse,
  mat,
  memoryMesh,
  olive,
  PALETTE,
  pier,
  pine,
  roundTree,
  terrace,
  tripod,
  workshop,
  type Collider,
} from './props.ts'
import { MEMORIES, NPCS, REGIONS, TRANSFORMS, type Npc, type Region, type TransformPoint } from './regions.ts'
import { heightAt, waterAt } from './terrain.ts'

interface Dress {
  houses: number
  trees: () => THREE.Group
  treeCount: number
  walls?: boolean
  columns?: number
  piers?: boolean
  workshop?: boolean
  lighthouse?: boolean
}

const DRESS: Record<string, Dress> = {
  nonacris: { houses: 7, trees: pine, treeCount: 40 },
  delphi: { houses: 3, trees: cypress, treeCount: 24, columns: 8 },
  thebes: { houses: 12, trees: olive, treeCount: 22, walls: true },
  corinth: { houses: 9, trees: () => roundTree(true), treeCount: 16, piers: true, lighthouse: true },
  crete: { houses: 6, trees: olive, treeCount: 36, workshop: true },
  thrace: { houses: 5, trees: pine, treeCount: 46, lighthouse: true },
}

function place(obj: THREE.Object3D, x: number, z: number, scene: THREE.Group) {
  obj.position.set(x, heightAt(x, z), z)
  scene.add(obj)
}

function scatter(scene: THREE.Group, region: Region, colliders: Collider[], dress: Dress, rand: () => number) {
  for (let i = 0; i < dress.houses; i++) {
    const a = rand() * Math.PI * 2
    const d = 6 + rand() * 22
    const x = region.x + Math.cos(a) * d
    const z = region.z + Math.sin(a) * d
    if (waterAt(x, z) !== null) continue
    const h = house(0.8 + rand() * 0.5)
    h.rotation.y = Math.round(rand() * 4) * (Math.PI / 2) + region.x * 0.01
    place(h, x, z, scene)
    colliders.push({ x, z, r: 2.8 })
    if (i % 3 === 0) place(lampPost(i < 6), x + 3.2, z + 2.6, scene)
  }
  for (let i = 0; i < dress.treeCount; i++) {
    const a = rand() * Math.PI * 2
    const d = 14 + rand() * (region.r - 14)
    const x = region.x + Math.cos(a) * d
    const z = region.z + Math.sin(a) * d
    if (waterAt(x, z) !== null || heightAt(x, z) > 40) continue
    const t = dress.trees()
    t.scale.setScalar(0.8 + rand() * 0.6)
    place(t, x, z, scene)
    colliders.push({ x, z, r: 0.7 })
  }
}

function landmarks(scene: THREE.Group, region: Region, colliders: Collider[], dress: Dress) {
  if (dress.columns) {
    place(terrace(26, 14, 1.2), region.x, region.z - 6, scene)
    for (let i = 0; i < dress.columns; i++) {
      const x = region.x - 10 + i * 3
      place(column(4), x, region.z - 12, scene)
      colliders.push({ x, z: region.z - 12, r: 0.6 })
    }
    place(tripod(), region.x + 6, region.z - 4, scene)
  }
  if (dress.walls) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      if (i % 4 === 0) continue // gates
      const w = box(2, 3.5, 9, PALETTE.wallShade)
      w.rotation.y = -a
      place(w, region.x + Math.cos(a) * 30, region.z + Math.sin(a) * 30, scene)
    }
  }
  if (dress.piers) {
    place(pier(), region.x - 6, region.z + 40, scene)
    place(pier(), region.x + 8, region.z + 40, scene)
  }
  if (dress.workshop) place(workshop(), region.x + 12, region.z + 4, scene)
  if (dress.lighthouse) place(lighthouse(), region.x + 22, region.z + 26, scene)
}

export function shrineMesh(point: TransformPoint) {
  const g = new THREE.Group()
  const color = { spring: 0x8fe0e4, shrine: PALETTE.stone, grove: 0x9fd07a, pool: 0x8fe0e4 }[point.kind]
  if (point.kind === 'shrine') {
    for (let i = 0; i < 4; i++) {
      const c = column(3)
      c.position.set(i % 2 ? 2 : -2, 0, i < 2 ? 2 : -2)
      g.add(c)
    }
    g.add(box(5.5, 0.4, 5.5, PALETTE.stone, 3.4))
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 24), mat(color))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.3
    g.add(ring)
  }
  return g
}

function npcMesh(npc: Npc) {
  const g = new THREE.Group()
  if (npc.name?.includes('tree')) g.add(olive())
  else {
    g.add(box(0.9, 1.5, 0.6, 0xc9a97a, 0.75))
    g.add(box(0.6, 0.6, 0.6, 0xe9c9a5, 1.8))
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 5), mat(0x8a3a3a))
    hat.position.y = 2.4
    g.add(hat)
  }
  return g
}

// Returns colliders for the player and the interactive props for the engine.
export function dressWorld(scene: THREE.Group) {
  const colliders: Collider[] = []
  REGIONS.forEach((region, i) => {
    const dress = DRESS[region.id]
    scatter(scene, region, colliders, dress, seeded(101 + i * 7))
    landmarks(scene, region, colliders, dress)
  })
  for (const t of TRANSFORMS) place(shrineMesh(t), t.x, t.z, scene)
  let nameIndex = 0
  const npcs = NPCS.map((npc) => {
    const name = npc.name ?? NAMES[nameIndex++ % NAMES.length]
    const mesh = npcMesh(npc)
    place(mesh, npc.x, npc.z, scene)
    return { ...npc, name, mesh }
  })
  const memories = MEMORIES.map((m) => {
    const mesh = memoryMesh()
    mesh.position.set(m.x, heightAt(m.x, m.z) + m.lift, m.z)
    scene.add(mesh)
    return { ...m, mesh }
  })
  return { colliders, npcs, memories }
}
