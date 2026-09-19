// Restrained particles: a burst when a form changes, drifting seeds that
// show the air to an owl.

import * as THREE from 'three'

interface Burst {
  points: THREE.Points
  velocities: Float32Array
  life: number
}

export class Particles {
  private bursts: Burst[] = []
  private scene: THREE.Scene
  readonly seeds: THREE.Points

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const n = 400
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120
      pos[i * 3 + 1] = Math.random() * 40
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.seeds = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff4d6, size: 0.35, transparent: true, opacity: 0.7 }))
    this.seeds.visible = false
    scene.add(this.seeds)
  }

  burst(at: THREE.Vector3, color: number) {
    const n = 80
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y + 1, at.z], i * 3)
      const a = Math.random() * Math.PI * 2
      const s = 2 + Math.random() * 5
      vel.set([Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.5, transparent: true }))
    this.scene.add(points)
    this.bursts.push({ points, velocities: vel, life: 1.2 })
  }

  update(dt: number, center: THREE.Vector3, showSeeds: boolean) {
    this.seeds.visible = showSeeds
    if (showSeeds) {
      this.seeds.position.set(center.x, 0, center.z)
      const p = this.seeds.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) p.setX(i, ((p.getX(i) + 60 + dt * 2.5) % 120) - 60)
      p.needsUpdate = true
    }
    for (const b of this.bursts) this.step(b, dt)
    this.bursts = this.bursts.filter((b) => b.life > 0 || (this.scene.remove(b.points), false))
  }

  private step(b: Burst, dt: number) {
    b.life -= dt
    const p = b.points.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      b.velocities[i * 3 + 1] -= 6 * dt
      p.setXYZ(
        i,
        p.getX(i) + b.velocities[i * 3] * dt,
        p.getY(i) + b.velocities[i * 3 + 1] * dt,
        p.getZ(i) + b.velocities[i * 3 + 2] * dt,
      )
    }
    p.needsUpdate = true
    ;(b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / 1.2)
  }
}
