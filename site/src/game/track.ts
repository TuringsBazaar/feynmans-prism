// Cart tracks the way the coastal line draws them: two rails on wooden
// sleepers, trestle legs wherever the line leaves the ground.

import * as THREE from 'three'
import { mat, PALETTE } from './props.ts'
import { heightAt } from './terrain.ts'

const GAUGE = 0.55
const SLEEPER_EVERY = 1.3
const LEG_EVERY = 4

function offsetCurve(curve: THREE.CatmullRomCurve3, side: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 80; i++) {
    const u = i / 80
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    const n = new THREE.Vector3(t.z, 0, -t.x).normalize()
    pts.push(p.clone().addScaledVector(n, side * GAUGE))
  }
  return new THREE.CatmullRomCurve3(pts)
}

function sleepers(curve: THREE.CatmullRomCurve3, length: number) {
  const n = Math.floor(length / SLEEPER_EVERY)
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.14, 0.4), mat(PALETTE.wood), n)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(t.x, 0, t.z).normalize())
    m.compose(p.clone().addScaledVector(up, -0.12), q, new THREE.Vector3(1, 1, 1))
    mesh.setMatrixAt(i, m)
  }
  mesh.castShadow = true
  return mesh
}

function trestle(curve: THREE.CatmullRomCurve3, length: number) {
  const g = new THREE.Group()
  const n = Math.floor(length / LEG_EVERY)
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n)
    const ground = heightAt(p.x, p.z)
    const drop = p.y - 0.2 - ground
    if (drop < 1.2) continue
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, drop, 0.22), mat(PALETTE.darkWood))
      leg.position.set(p.x + side * 0.8, ground + drop / 2, p.z)
      g.add(leg)
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), mat(PALETTE.darkWood))
    brace.position.set(p.x, ground + drop * 0.5, p.z)
    g.add(brace)
  }
  return g
}

export function buildTrack(curve: THREE.CatmullRomCurve3, length: number) {
  const g = new THREE.Group()
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(offsetCurve(curve, side), 160, 0.07, 4, false), mat(0x8a8fa0))
    g.add(rail)
  }
  g.add(sleepers(curve, length), trestle(curve, length))
  return g
}

// The tram-green cart with cream trim and a lantern up front.
export function cartBody() {
  const g = new THREE.Group()
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 2.8), mat(PALETTE.tram))
  bed.position.y = 1.05
  bed.castShadow = true
  g.add(bed)
  for (const y of [1.62, 0.55]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 2.9), mat(PALETTE.trim))
    trim.position.y = y
    g.add(trim)
  }
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10, 1, false, 0, Math.PI), mat(PALETTE.tram))
  roof.rotation.z = Math.PI / 2
  roof.rotation.y = Math.PI / 2
  roof.position.y = 2.3
  g.add(roof)
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.35, 0.3),
    new THREE.MeshLambertMaterial({ color: PALETTE.window, emissive: PALETTE.window, emissiveIntensity: 0.8 }),
  )
  lantern.position.set(0, 1.9, 1.5)
  g.add(lantern)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), mat(0x3a2a1a))
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.45, z)
    g.add(wheel)
  }
  g.name = 'body'
  return g
}
