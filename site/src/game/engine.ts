// The game loop and the glue between systems. React owns the DOM; this owns
// the canvas and pushes a small HudState snapshot up ten times a second.

import * as THREE from 'three'
import { GameAudio } from './audio.ts'
import { FollowCamera } from './camera.ts'
import { Cart } from './cart.ts'
import { Controls, type Input } from './controls.ts'
import { dressWorld } from './dress.ts'
import { Eridanus } from './eridanus.ts'
import { Interactions, type Prompt } from './interactions.ts'
import { Ambience } from './music.ts'
import { damp } from './noise.ts'
import { Particles } from './particles.ts'
import { CART_CAM, Player } from './player.ts'
import { REGIONS, SEA_OVID, START, TRACKS, type Form } from './regions.ts'
import { clearSave, loadSave, writeSave } from './save.ts'
import { DUSK, GOLDEN, Sky } from './sky.ts'
import { buildTerrain, buildWater, regionAt, waterAt } from './terrain.ts'

export interface HudState {
  region: string
  ovid: string
  book: string
  form: Form
  prompt: Prompt | null
  dialogue: { name: string; text: string } | null
  cart: { speed: number; braking: boolean } | null
  mapOpen: boolean
  complete: boolean
  playerMap: { x: number; z: number }
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly view: FollowCamera
  readonly player = new Player()
  readonly controls: Controls
  readonly container: HTMLElement
  readonly audio = new GameAudio()
  readonly music = new Ambience('/music/ambience.mp3')
  readonly particles: Particles
  readonly eridanus = new Eridanus()
  readonly sky = new Sky()
  readonly carts: Cart[]
  readonly hemi = new THREE.HemisphereLight(GOLDEN.hemiSky, GOLDEN.hemiGround, 0.85)
  readonly sun = new THREE.DirectionalLight(GOLDEN.sunLight, 1.5)
  readonly world: ReturnType<typeof dressWorld>
  readonly found = new Set<string>()
  interactions: Interactions
  mapOpen = false
  complete = false
  private onHud: (s: HudState) => void
  private timer = new THREE.Timer()
  private dusk = 0
  private hudTimer = 0
  private saveTimer = 0
  private raf = 0
  private onResize = () => this.resize()

  constructor(container: HTMLElement, controls: Controls, onHud: (s: HudState) => void) {
    this.container = container
    this.controls = controls
    this.onHud = onHud
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.view = new FollowCamera(new THREE.PerspectiveCamera(60, 1, 0.5, 1800))
    container.appendChild(this.renderer.domElement)
    controls.bind(this.renderer.domElement)
    this.scene.fog = new THREE.Fog(GOLDEN.fog, 90, 560)
    this.setupLights()
    const ground = new THREE.Group()
    ground.add(buildTerrain(), buildWater())
    this.world = dressWorld(ground)
    this.scene.add(ground, this.player.group, this.eridanus.group, this.sky.group)
    this.carts = TRACKS.map((t) => new Cart(t))
    for (const c of this.carts) this.scene.add(c.mesh)
    this.particles = new Particles(this.scene)
    this.interactions = new Interactions(this)
    this.restore()
    this.resize()
    window.addEventListener('resize', this.onResize)
  }

  private setupLights() {
    this.scene.add(this.hemi, this.sun, new THREE.AmbientLight(0xffe4d0, 0.25))
    this.sun.position.copy(this.sky.sunDir).multiplyScalar(220)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.radius = 4
    this.sun.shadow.bias = -0.0005
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -90
    cam.right = cam.top = 90
    cam.far = 700
    this.sun.target = this.player.group
  }

  private restore() {
    const save = loadSave()
    if (!save) return this.player.place(START.x, START.z)
    for (const id of save.memories) this.found.add(id)
    this.world.memories.forEach((m) => (m.mesh.visible = !this.found.has(m.region)))
    this.player.setForm(save.form)
    this.player.place(save.x, save.z, save.y)
    if (this.found.size === REGIONS.length) this.eridanus.reveal()
  }

  restart() {
    clearSave()
    location.reload()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.view.camera.aspect = w / h
    this.view.camera.updateProjectionMatrix()
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.timer.update()
      this.step(Math.min(this.timer.getDelta(), 0.05))
    }
    loop()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.controls.unbind(this.renderer.domElement)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private step(dt: number) {
    const input = this.controls.read()
    if (input.any) {
      this.audio.start()
      this.music.start()
    }
    if (input.map) this.mapOpen = !this.mapOpen
    const cart = this.carts.find((c) => c.riding)
    // Camera-relative movement: walking forward adopts the direction you look.
    if (!cart && input.forward !== 0) this.player.heading += this.view.takeYaw()
    if (cart) this.rideStep(dt, input, cart)
    else this.player.update(dt, input, this.world.colliders)
    this.interactions.update(dt, input)
    this.collectMemories()
    const p = this.player
    this.view.update(dt, input, p.pos, p.heading, cart ? CART_CAM : p.stats.cam, p.form === 'naiad' && p.submerged)
    this.sun.position.copy(p.pos).addScaledVector(this.sky.sunDir, 220)
    this.atmosphere(dt)
    this.sky.update(dt, this.view.camera.position)
    this.particles.update(dt, p.pos, p.form === 'owl')
    this.eridanus.update(dt)
    this.music.update(dt)
    this.renderer.render(this.scene, this.view.camera)
    this.tick(dt)
  }

  private rideStep(dt: number, input: Input, cart: Cart) {
    const ride = cart.update(dt, input)
    this.player.pos.copy(ride.position).y += 0.6
    this.player.heading = ride.heading
    this.player.bank = ride.roll
    this.player.group.position.copy(this.player.pos)
    this.player.group.rotation.set(0, ride.heading, ride.roll)
  }

  private collectMemories() {
    for (const m of this.world.memories) {
      if (!m.mesh.visible) continue
      m.mesh.rotation.y += 0.02
      if (this.player.pos.distanceTo(m.mesh.position) < 3) {
        m.mesh.visible = false
        this.found.add(m.region)
        this.audio.chime()
        this.particles.burst(m.mesh.position, 0xffd27a)
        this.interactions.say('memory', m.text)
        if (this.found.size === REGIONS.length) this.eridanus.reveal()
        this.save()
      }
    }
    if (this.eridanus.group.visible && !this.complete && this.player.pos.distanceTo(this.eridanus.source) < 8) {
      this.complete = true
      this.audio.chime()
      this.interactions.say('Eridanus', 'The source. Every road you learned is still open; keep going.')
    }
  }

  // Owls see the dusk: lavender sky and fog, cooler light, stars, brighter memories.
  private atmosphere(dt: number) {
    const want = this.player.form === 'owl' ? 1 : 0
    const before = this.dusk
    this.dusk += (want - this.dusk) * damp(1.2, dt)
    if (Math.abs(this.dusk - before) < 0.0005 && Math.abs(this.dusk - want) < 0.002) return
    const t = this.dusk
    const fog = this.scene.fog as THREE.Fog
    fog.color.set(new THREE.Color(GOLDEN.fog).lerp(new THREE.Color(DUSK.fog), t))
    this.sun.color.set(new THREE.Color(GOLDEN.sunLight).lerp(new THREE.Color(DUSK.sunLight), t))
    this.hemi.color.set(new THREE.Color(GOLDEN.hemiSky).lerp(new THREE.Color(DUSK.hemiSky), t))
    this.hemi.groundColor.set(new THREE.Color(GOLDEN.hemiGround).lerp(new THREE.Color(DUSK.hemiGround), t))
    this.hemi.intensity = 0.85 - 0.3 * t
    this.sun.intensity = 1.5 - 0.7 * t
    this.sky.setDusk(t)
    for (const m of this.world.memories) (m.mesh.children[0] as THREE.PointLight).intensity = 12 + 28 * t
  }

  private tick(dt: number) {
    this.hudTimer += dt
    this.saveTimer += dt
    if (this.saveTimer > 5) {
      this.saveTimer = 0
      this.save()
    }
    if (this.hudTimer < 0.1) return
    this.hudTimer = 0
    const cart = this.carts.find((c) => c.riding)
    const region = regionAt(this.player.pos.x, this.player.pos.z)
    const passage = region ?? SEA_OVID
    this.onHud({
      region: region?.name ?? 'the open sea',
      ovid: passage.ovid,
      book: passage.book,
      form: this.player.form,
      prompt: this.interactions.prompt,
      dialogue: this.interactions.dialogue,
      cart: cart ? { speed: Math.abs(cart.speed), braking: this.interactions.braking } : null,
      mapOpen: this.mapOpen,
      complete: this.complete,
      playerMap: { x: this.player.pos.x, z: this.player.pos.z },
    })
  }

  save() {
    const p = this.player
    writeSave({ memories: [...this.found], form: p.form, x: p.pos.x, y: p.pos.y, z: p.pos.z })
  }

  // Q anywhere: on land walk → run → fly; in water swim ↔ fly.
  toggleForm() {
    const p = this.player
    const cycle: Form[] = waterAt(p.pos.x, p.pos.z) !== null && p.inWater ? ['naiad', 'owl'] : ['human', 'stag', 'owl']
    const next = cycle[(cycle.indexOf(p.form) + 1) % cycle.length]
    p.setForm(next)
    this.particles.burst(p.pos, { human: 0xe9c9a5, owl: 0xf2ead8, naiad: 0x7fe0e8, stag: 0x9fd07a }[next])
  }
}
