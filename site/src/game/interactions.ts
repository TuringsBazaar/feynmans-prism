// What E and Q do where the player stands: talk, board a cart, dive through
// a spring, change shape. Produces the contextual prompt for the HUD.

import type { Input } from './controls.ts'
import type { Engine } from './engine.ts'
import { POOLS } from './regions.ts'
import { heightAt, poolAt } from './terrain.ts'

export interface Prompt {
  key: 'E'
  text: string
}

export class Interactions {
  prompt: Prompt | null = null
  dialogue: { name: string; text: string } | null = null
  braking = false
  private engine: Engine
  private dialogueTimer = 0
  private lineIndex = new Map<string, number>()

  constructor(engine: Engine) {
    this.engine = engine
  }

  say(name: string, text: string) {
    this.dialogue = { name, text }
    this.dialogueTimer = 6
  }

  update(dt: number, input: Input) {
    this.dialogueTimer -= dt
    if (this.dialogueTimer <= 0) this.dialogue = null
    this.braking = input.forward < 0
    const riding = this.engine.carts.find((c) => c.riding)
    if (riding) return this.whileRiding(input, riding)
    this.prompt = this.nearestPrompt()
    if (input.interact) this.interact()
    if (input.transform) this.engine.toggleForm()
  }

  private whileRiding(input: Input, cart: (typeof this.engine.carts)[number]) {
    this.prompt = { key: 'E', text: 'leave the cart' }
    if (input.interact) this.leaveCart(cart)
  }

  private leaveCart(cart: (typeof this.engine.carts)[number]) {
    cart.leave()
    const p = this.engine.player
    p.pos.x += Math.cos(p.heading) * 2
    p.pos.z -= Math.sin(p.heading) * 2
    p.pos.y = heightAt(p.pos.x, p.pos.z)
    p.vy = 0
  }

  private near(x: number, z: number, r: number) {
    const p = this.engine.player.pos
    return Math.hypot(p.x - x, p.z - z) < r
  }

  private nearestPrompt(): Prompt | null {
    const p = this.engine.player
    const npc = this.engine.world.npcs.find((n) => this.near(n.x, n.z, 4))
    if (npc) return { key: 'E', text: `speak with ${npc.name}` }
    if (this.engine.carts.some((c) => c.nearEnd(p.pos.x, p.pos.z) !== null)) return { key: 'E', text: 'ride the cart' }
    const pool = poolAt(p.pos.x, p.pos.z)
    if (pool?.spring && p.form === 'naiad') return { key: 'E', text: 'follow the spring' }
    return null
  }

  private interact() {
    const p = this.engine.player
    const npc = this.engine.world.npcs.find((n) => this.near(n.x, n.z, 4))
    if (npc) {
      const i = this.lineIndex.get(npc.name) ?? 0
      this.lineIndex.set(npc.name, i + 1)
      return this.say(npc.name, npc.lines[i % npc.lines.length])
    }
    for (const cart of this.engine.carts) {
      const at = cart.nearEnd(p.pos.x, p.pos.z)
      if (at !== null) return cart.board(at)
    }
    const pool = poolAt(p.pos.x, p.pos.z)
    if (pool?.spring && p.form === 'naiad') this.travelSpring(pool.spring)
  }

  // Submerged passages: enter one spring, surface at its twin.
  private travelSpring(targetId: string) {
    const target = POOLS.find((q) => q.id === targetId)
    if (!target) return
    const p = this.engine.player
    this.engine.particles.burst(p.pos, 0x7fe0e8)
    p.place(target.x, target.z, target.y)
    this.engine.particles.burst(p.pos, 0x7fe0e8)
    this.say('the spring', 'The water remembers the way.')
  }
}
