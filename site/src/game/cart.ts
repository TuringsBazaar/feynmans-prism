// Wooden mountain carts on curved tracks. The player boards at either end,
// W accelerates, S brakes; inertia and cornering roll do the rest.

import * as THREE from 'three'
import type { Input } from './controls.ts'
import { clamp } from './noise.ts'
import type { Track } from './regions.ts'
import { heightAt } from './terrain.ts'
import { buildTrack, cartBody } from './track.ts'

const ACCEL = 7
const BRAKE = 14
const DRAG = 0.6
const MAX_SPEED = 22
const GRAVITY_PULL = 5 // downhill slope pulls, uphill slows

export class Cart {
  readonly curve: THREE.CatmullRomCurve3
  readonly mesh: THREE.Group
  readonly length: number
  distance = 0
  speed = 0
  riding = false
  private dir = 1 // +1 rides toward the far end, −1 back; fixed when boarding
  readonly track: Track
  private lookup: number[] = []

  constructor(track: Track) {
    this.track = track
    const pts = track.points.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.6, z))
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
    this.length = this.curve.getLength()
    this.lookup = this.curve.getLengths(200)
    this.mesh = new THREE.Group()
    this.mesh.add(buildTrack(this.curve, this.length), cartBody())
    this.setPose(0)
  }

  get bodyMesh() {
    return this.mesh.getObjectByName('body')!
  }

  // Distance along the track → curve parameter, via the cached arc lengths.
  private u(distance: number) {
    const d = clamp(distance, 0, this.length)
    let lo = 0
    let hi = this.lookup.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.lookup[mid] < d) lo = mid + 1
      else hi = mid
    }
    return lo / (this.lookup.length - 1)
  }

  private setPose(distance: number) {
    const u = this.u(distance)
    const p = this.curve.getPointAt(u)
    const tangent = this.curve.getTangentAt(u)
    const body = this.bodyMesh
    body.position.copy(p)
    body.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0)
    return { p, tangent }
  }

  nearEnd(x: number, z: number) {
    const a = this.curve.getPointAt(0)
    const b = this.curve.getPointAt(1)
    if (Math.hypot(a.x - x, a.z - z) < 5) return 0
    if (Math.hypot(b.x - x, b.z - z) < 5) return this.length
    return null
  }

  board(atDistance: number) {
    this.riding = true
    this.distance = atDistance
    this.dir = atDistance < this.length / 2 ? 1 : -1
    this.speed = 0
    this.setPose(atDistance)
  }

  // Returns the seat position and heading; the player mirrors them.
  update(dt: number, input: Input) {
    const u = this.u(this.distance)
    const slope = this.curve.getTangentAt(u).y * this.dir
    let accel = input.forward > 0 ? ACCEL : 0
    if (input.forward < 0) accel -= BRAKE * Math.sign(this.speed || 1)
    accel -= slope * GRAVITY_PULL
    this.speed += (accel - DRAG * this.speed) * dt
    this.speed = clamp(this.speed, 0, MAX_SPEED)
    this.distance += this.speed * this.dir * dt
    const atEnd = this.distance <= 0 || this.distance >= this.length
    this.distance = clamp(this.distance, 0, this.length)
    if (atEnd) this.speed = 0
    const { p, tangent } = this.setPose(this.distance)
    const roll = this.cornerRoll(u) * this.speed * 0.02
    this.bodyMesh.rotation.z = roll
    return { position: p, heading: Math.atan2(tangent.x, tangent.z), braking: input.forward < 0, atEnd, roll }
  }

  private cornerRoll(u: number) {
    const a = this.curve.getTangentAt(Math.max(0, u - 0.02))
    const b = this.curve.getTangentAt(Math.min(1, u + 0.02))
    return a.x * b.z - a.z * b.x // signed turn rate
  }

  leave() {
    this.riding = false
    this.speed = 0
  }
}
