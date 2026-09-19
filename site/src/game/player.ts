// The player in four bodies. Each form is its own movement law; the camera
// follows with per-form distance and field of view, blended on change.

import * as THREE from 'three'
import type { Input } from './controls.ts'
import { clamp, damp, lerp } from './noise.ts'
import type { Collider } from './props.ts'
import { THERMALS, type Form } from './regions.ts'
import { heightAt, waterAt, WORLD } from './terrain.ts'
import { mat } from './props.ts'

const GRAVITY = 24
const FORM_STATS = {
  human: { speed: 9, jump: 7, turn: 2.6, cam: { dist: 11, height: 4, fov: 60 } },
  stag: { speed: 18, jump: 10, turn: 2.4, cam: { dist: 13, height: 4.5, fov: 66 } },
  owl: { speed: 22, jump: 0, turn: 1.9, cam: { dist: 16, height: 5, fov: 78 } },
  naiad: { speed: 11, jump: 0, turn: 2.8, cam: { dist: 9, height: 3, fov: 62 } },
}
export const CART_CAM = { dist: 14, height: 5, fov: 66 }

export class Player {
  readonly group = new THREE.Group()
  readonly pos = new THREE.Vector3()
  readonly safe = new THREE.Vector3()
  form: Form = 'human'
  heading = 0
  vy = 0
  airSpeed = 8
  onGround = true
  inWater = false
  submerged = false
  bank = 0
  bob = 0
  private bodies: Record<Form, THREE.Group>
  private safeTimer = 0
  private flapTimer = 0

  constructor() {
    this.bodies = { human: this.human(), owl: this.owl(), naiad: this.naiad(), stag: this.stag() }
    for (const b of Object.values(this.bodies)) this.group.add(b)
    this.setForm('human')
  }

  private human() {
    const g = new THREE.Group()
    g.add(this.part(new THREE.BoxGeometry(0.8, 1.4, 0.5), 0xc76b4a, 0.7))
    g.add(this.part(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xe9c9a5, 1.7))
    return g
  }

  private owl() {
    const g = new THREE.Group()
    g.add(this.part(new THREE.ConeGeometry(0.45, 1.2, 6), 0x8a6a4a, 0.6, Math.PI / 2))
    g.add(this.part(new THREE.SphereGeometry(0.35, 6, 5), 0xa08a6a, 0.9))
    for (const side of [-1, 1]) {
      const wing = this.part(new THREE.BoxGeometry(1.8, 0.08, 0.7), 0x7a5a3a, 0.7)
      wing.position.x = side * 1.1
      wing.name = side < 0 ? 'wingL' : 'wingR'
      g.add(wing)
    }
    return g
  }

  private naiad() {
    const g = new THREE.Group()
    const m = new THREE.MeshLambertMaterial({ color: 0x7fe0e8, transparent: true, opacity: 0.75, emissive: 0x104050 })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 3, 8), m)
    body.position.y = 0.9
    g.add(body)
    return g
  }

  private stag() {
    const g = new THREE.Group()
    g.add(this.part(new THREE.BoxGeometry(0.8, 0.8, 1.8), 0x8a5a3a, 1.1))
    g.add(this.part(new THREE.BoxGeometry(0.4, 0.5, 0.7), 0x8a5a3a, 1.7, 0, 0.9))
    for (const side of [-1, 1]) {
      const antler = this.part(new THREE.ConeGeometry(0.08, 0.9, 4), 0xe0d0b0, 2.4, 0, 0.9)
      antler.position.x = side * 0.22
      antler.rotation.z = side * 0.4
      g.add(antler)
    }
    for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) {
      const leg = this.part(new THREE.BoxGeometry(0.16, 0.8, 0.16), 0x6a4a2a, 0.4, 0, z)
      leg.position.x = x
      g.add(leg)
    }
    return g
  }

  private part(geo: THREE.BufferGeometry, color: number, y: number, rx = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(0, y, z)
    m.rotation.x = rx
    m.castShadow = true
    return m
  }

  setForm(form: Form) {
    this.form = form
    for (const [f, b] of Object.entries(this.bodies)) b.visible = f === form
    if (form === 'owl') this.pos.y = Math.max(this.pos.y, heightAt(this.pos.x, this.pos.z) + 2)
    this.vy = 0
  }

  get stats() {
    return FORM_STATS[this.form]
  }

  // Walkers who wade in become naiads; a naiad who climbs out walks again.
  private swapForWater(water: number | null) {
    if (this.form === 'owl') return
    if (water !== null && this.inWater && this.form !== 'naiad') this.setForm('naiad')
    if (water === null && this.form === 'naiad') this.setForm('human')
  }

  update(dt: number, input: Input, colliders: Collider[]) {
    const water = waterAt(this.pos.x, this.pos.z)
    this.inWater = water !== null && this.pos.y <= water + 0.3
    this.swapForWater(water)
    if (this.form === 'owl' && !(this.inWater && this.pos.y < (water ?? 0) - 0.5)) this.flyStep(dt, input)
    else if (this.form === 'naiad' && water !== null) this.swimStep(dt, input, water)
    else this.groundStep(dt, input, water)
    this.collide(colliders)
    this.keepInWorld()
    this.recoverIfFallen(dt)
    this.group.position.copy(this.pos)
    this.group.rotation.set(0, this.heading, this.bank)
    this.animate(dt, input)
  }

  private groundStep(dt: number, input: Input, water: number | null) {
    const s = this.stats
    const speed = (water !== null ? 4 : s.speed) * input.forward
    this.heading -= input.turn * s.turn * dt
    this.pos.x += Math.sin(this.heading) * speed * dt
    this.pos.z += Math.cos(this.heading) * speed * dt
    const ground = water !== null ? Math.max(water, heightAt(this.pos.x, this.pos.z)) : heightAt(this.pos.x, this.pos.z)
    this.vy -= GRAVITY * dt
    if (this.onGround && input.up && s.jump > 0) this.vy = s.jump
    this.pos.y += this.vy * dt
    this.onGround = this.pos.y <= ground
    if (this.onGround) {
      this.pos.y = ground
      this.vy = 0
    }
    this.bob += Math.abs(speed) * dt
    this.bank = lerp(this.bank, 0, damp(8, dt))
  }

  private flyStep(dt: number, input: Input) {
    const s = this.stats
    this.airSpeed = clamp(this.airSpeed + input.forward * 10 * dt, 5, s.speed)
    this.heading -= input.turn * s.turn * dt
    this.bank = lerp(this.bank, -input.turn * 0.6, damp(4, dt))
    let lift = -1.2
    if (input.up) lift = 8
    if (input.down) lift = -10
    if (THERMALS.some((t) => Math.hypot(this.pos.x - t.x, this.pos.z - t.z) < t.r)) lift += 6
    this.pos.x += Math.sin(this.heading) * this.airSpeed * dt
    this.pos.z += Math.cos(this.heading) * this.airSpeed * dt
    this.pos.y = clamp(this.pos.y + lift * dt, Math.max(0.5, heightAt(this.pos.x, this.pos.z) + 1), 140)
    this.onGround = this.pos.y <= heightAt(this.pos.x, this.pos.z) + 1.05
    this.flapTimer = input.up ? this.flapTimer + dt : 0
  }

  private swimStep(dt: number, input: Input, surface: number) {
    const s = this.stats
    this.heading -= input.turn * s.turn * dt
    this.pos.x += Math.sin(this.heading) * s.speed * input.forward * dt
    this.pos.z += Math.cos(this.heading) * s.speed * input.forward * dt
    const floor = heightAt(this.pos.x, this.pos.z) + 0.4
    let dive = 0
    if (input.down) dive = -6
    if (input.up) dive = 6
    this.pos.y = clamp(this.pos.y + dive * dt, Math.min(floor, surface - 0.2), surface)
    this.submerged = this.pos.y < surface - 0.5
    this.onGround = false
    this.bob += Math.abs(input.forward) * dt * 4
  }

  private collide(colliders: Collider[]) {
    if (this.form === 'owl' && !this.onGround) return
    for (const c of colliders) {
      const dx = this.pos.x - c.x
      const dz = this.pos.z - c.z
      const d = Math.hypot(dx, dz)
      if (d < c.r + 0.5 && d > 0.001) {
        const push = (c.r + 0.5 - d) / d
        this.pos.x += dx * push
        this.pos.z += dz * push
      }
    }
  }

  private keepInWorld() {
    const lim = WORLD / 2 - 4
    this.pos.x = clamp(this.pos.x, -lim, lim)
    this.pos.z = clamp(this.pos.z, -lim, lim)
  }

  // Remember the last solid footing; if anything goes wrong, go back there.
  private recoverIfFallen(dt: number) {
    this.safeTimer += dt
    const bad = !Number.isFinite(this.pos.x + this.pos.y + this.pos.z) || this.pos.y < -20
    if (bad) {
      this.pos.copy(this.safe)
      this.vy = 0
      return
    }
    if (this.safeTimer > 2 && this.onGround && !this.inWater) {
      this.safe.copy(this.pos)
      this.safeTimer = 0
    }
  }

  private animate(dt: number, input: Input) {
    const body = this.bodies[this.form]
    if (this.form === 'owl') {
      const flap = input.up ? Math.sin(this.flapTimer * 14) * 0.7 : 0.15
      body.getObjectByName('wingL')!.rotation.z = flap
      body.getObjectByName('wingR')!.rotation.z = -flap
      body.rotation.x = input.up ? -0.2 : input.down ? 0.25 : 0
    } else if (this.form === 'stag') body.position.y = this.onGround ? Math.abs(Math.sin(this.bob * 1.2)) * 0.35 : 0.3
    else body.position.y = this.onGround ? Math.abs(Math.sin(this.bob * 1.6)) * 0.12 : 0
    if (this.form === 'naiad') body.rotation.x = lerp(body.rotation.x, this.submerged ? 0.6 : 0, damp(5, dt))
  }

  place(x: number, z: number, y?: number) {
    this.pos.set(x, y ?? heightAt(x, z), z)
    this.safe.copy(this.pos)
  }
}
