// The golden hour: a gradient dome, one soft sun that becomes a moon at
// dusk, stars, puffy low-poly clouds drifting at mid-height, and sparkle on
// the sea. `setDusk(t)` blends the whole sky between the two moods.

import * as THREE from 'three'
import { seeded, smoothstep } from './noise.ts'
import { heightAt, WORLD } from './terrain.ts'

export const GOLDEN = {
  zenith: 0xa8a0c8,
  horizon: 0xf0cdbb,
  fog: 0xe6cfc6,
  sun: 0xfff1d6,
  sunLight: 0xffd9b0,
  hemiSky: 0xcdbfe2,
  hemiGround: 0x8f9c72,
}
export const DUSK = {
  zenith: 0x5e5480,
  horizon: 0xc7a2a8,
  fog: 0xa793b4,
  sun: 0xe8e4f4,
  sunLight: 0xb8a8d8,
  hemiSky: 0x8c7fb0,
  hemiGround: 0x5c6650,
}

function domeGeometry(radius: number) {
  const geo = new THREE.SphereGeometry(radius, 24, 12)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function sunTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.22, 'rgba(255,248,232,0.95)')
  g.addColorStop(0.32, 'rgba(255,235,210,0.28)')
  g.addColorStop(0.6, 'rgba(255,225,200,0.08)')
  g.addColorStop(1, 'rgba(255,220,190,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

function cloud(rand: () => number) {
  const g = new THREE.Group()
  // Mostly self-lit: a low sun would otherwise shade faceted puffs into rocks.
  const m = new THREE.MeshLambertMaterial({ color: 0xfaf3f2, emissive: 0xf3e6e8, emissiveIntensity: 0.6 })
  const n = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < n; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rand() * 4, 1), m)
    puff.position.set((i - n / 2) * 4 + rand() * 2, rand() * 1.5, (rand() - 0.5) * 4)
    puff.scale.y = 0.55
    g.add(puff)
  }
  return g
}

function sparkles() {
  const rand = seeded(7)
  const pts: number[] = []
  for (let i = 0; i < 6000 && pts.length < 4500; i++) {
    const x = (rand() - 0.5) * WORLD
    const z = (rand() - 0.5) * WORLD
    if (heightAt(x, z) < -0.5) pts.push(x, 0.12, z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.55 }))
}

export class Sky {
  readonly group = new THREE.Group()
  readonly dome: THREE.Mesh
  readonly sun: THREE.Sprite
  readonly stars: THREE.Points
  readonly clouds: THREE.Group[] = []
  readonly sunDir = new THREE.Vector3(-0.55, 0.32, 0.77).normalize()
  private sea: THREE.Points
  private t = 0

  constructor() {
    this.dome = new THREE.Mesh(domeGeometry(850), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }))
    this.sun.scale.setScalar(110)
    this.stars = this.makeStars()
    this.sea = sparkles()
    this.group.add(this.dome, this.sun, this.stars, this.sea)
    const rand = seeded(23)
    for (let i = 0; i < 26; i++) {
      const c = cloud(rand)
      c.position.set((rand() - 0.5) * WORLD * 1.2, 34 + rand() * 40, (rand() - 0.5) * WORLD * 1.2)
      this.clouds.push(c)
      this.group.add(c)
    }
    this.setDusk(0)
  }

  private makeStars() {
    const rand = seeded(3)
    const pts: number[] = []
    for (let i = 0; i < 500; i++) {
      const a = rand() * Math.PI * 2
      const e = 0.15 + rand() * 1.3
      pts.push(Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0, fog: false }))
  }

  // 0 = golden hour, 1 = the owl's dusk.
  setDusk(t: number) {
    const zenith = new THREE.Color(GOLDEN.zenith).lerp(new THREE.Color(DUSK.zenith), t)
    const horizon = new THREE.Color(GOLDEN.horizon).lerp(new THREE.Color(DUSK.horizon), t)
    const pos = this.dome.geometry.attributes.position
    const col = this.dome.geometry.attributes.color as THREE.BufferAttribute
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const ny = pos.getY(i) / 850
      c.copy(horizon).lerp(zenith, smoothstep(-0.02, 0.55, ny))
      col.setXYZ(i, c.r, c.g, c.b)
    }
    col.needsUpdate = true
    ;(this.sun.material as THREE.SpriteMaterial).color.set(new THREE.Color(GOLDEN.sun).lerp(new THREE.Color(DUSK.sun), t))
    this.sun.scale.setScalar(110 - 50 * t)
    ;(this.stars.material as THREE.PointsMaterial).opacity = 0.9 * t
  }

  update(dt: number, eye: THREE.Vector3) {
    this.t += dt
    this.dome.position.copy(eye)
    this.stars.position.copy(eye)
    this.sun.position.copy(eye).addScaledVector(this.sunDir, 700)
    for (const c of this.clouds) {
      c.position.x += dt * 1.2
      if (c.position.x > WORLD * 0.6) c.position.x = -WORLD * 0.6
    }
    ;(this.sea.material as THREE.PointsMaterial).opacity = 0.35 + 0.25 * Math.sin(this.t * 2.2)
  }
}
