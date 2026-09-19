// A follow camera you can also take hold of: drag to look around the player,
// middle-drag to pan, wheel to zoom. Standing still, a drag orbits freely;
// once you move, the look offset becomes your heading (see takeYaw), so
// dragging while walking steers. Zoom and pitch are yours to keep.

import * as THREE from 'three'
import type { Input } from './controls.ts'
import { clamp, damp } from './noise.ts'
import { heightAt } from './terrain.ts'

export interface CamParams {
  dist: number
  height: number
  fov: number
}

const LOOK_RATE = 0.005
const PAN_RATE = 0.03
const ZOOM_RATE = 0.0012

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera
  yaw = 0 // offset from the player's heading
  pitch = 0
  zoom = 1
  pan = new THREE.Vector3()
  private first = true

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  private absorb(input: Input, dt: number) {
    this.yaw -= input.look.dx * LOOK_RATE
    this.pitch = clamp(this.pitch + input.look.dy * LOOK_RATE, -0.5, 1.1)
    this.zoom = clamp(this.zoom * Math.exp(input.zoom * ZOOM_RATE), 0.35, 3.5)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    this.pan.addScaledVector(right, -input.pan.dx * PAN_RATE * this.zoom)
    this.pan.y += input.pan.dy * PAN_RATE * this.zoom
    if (input.forward !== 0 || input.turn !== 0) this.pan.multiplyScalar(1 - damp(3, dt))
  }

  // Hands the look offset to whoever owns the heading and zeroes it, so the
  // camera ends up directly behind the new heading with no swing.
  takeYaw() {
    const yaw = this.yaw
    this.yaw = 0
    return yaw
  }

  // Sea-or-sky feeling: far out, or looking from high above.
  get farOut() {
    return this.zoom > 2.2 || this.pitch > 0.7
  }

  update(dt: number, input: Input, pos: THREE.Vector3, heading: number, cam: CamParams, underwater: boolean) {
    this.absorb(input, dt)
    const dist = cam.dist * this.zoom
    const elevation = Math.atan2(cam.height, cam.dist) + this.pitch
    const yaw = heading + this.yaw
    const focus = pos.clone().add(this.pan)
    focus.y += 1.5
    const target = new THREE.Vector3(
      focus.x - Math.sin(yaw) * dist * Math.cos(elevation),
      focus.y + dist * Math.sin(elevation),
      focus.z - Math.cos(yaw) * dist * Math.cos(elevation),
    )
    target.y = Math.max(target.y, heightAt(target.x, target.z) + 1.5)
    if (underwater) target.y = Math.min(target.y, pos.y + 1)
    this.camera.position.lerp(target, this.first ? 1 : damp(input.dragging ? 14 : 5, dt))
    this.first = false
    this.camera.fov += (cam.fov - this.camera.fov) * damp(3, dt)
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(focus)
  }
}
