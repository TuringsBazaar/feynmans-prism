// The impossible river: a luminous tube across the sky, hidden until every
// memory is found. Its source is the last point of the spline.

import * as THREE from 'three'
import { ERIDANUS } from './regions.ts'

export class Eridanus {
  readonly group = new THREE.Group()
  readonly source: THREE.Vector3
  private material: THREE.MeshBasicMaterial
  private sparks: THREE.Points
  private t = 0

  constructor() {
    const points = ERIDANUS.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const curve = new THREE.CatmullRomCurve3(points)
    this.source = points[points.length - 1].clone()
    this.material = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 })
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 2.2, 8, false), this.material)
    this.group.add(tube)
    const n = 300
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const p = curve.getPointAt(i / n)
      pos.set([p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 8], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true }))
    this.group.add(this.sparks)
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    marker.position.copy(this.source)
    this.group.add(marker)
    this.group.visible = false
  }

  reveal() {
    this.group.visible = true
  }

  update(dt: number) {
    if (!this.group.visible) return
    this.t += dt
    this.material.opacity = 0.45 + 0.15 * Math.sin(this.t * 1.5)
    ;(this.sparks.material as THREE.PointsMaterial).opacity = 0.5 + 0.5 * Math.sin(this.t * 3)
  }
}
