// One looping track, playing from the first gesture on. The file is yours to
// supply (public/music/ambience.mp3); without it this stays silent.

import { damp } from './noise.ts'

export class Ambience {
  private audio: HTMLAudioElement
  private started = false
  private level = 0
  private missing = false
  private readonly volume: number

  constructor(src: string, volume = 0.6) {
    this.volume = volume
    this.audio = new Audio(src)
    this.audio.loop = true
    this.audio.preload = 'auto'
    this.audio.addEventListener('error', () => (this.missing = true))
  }

  // Browsers only allow playback after a user gesture; call once one happened.
  start() {
    if (this.started || this.missing) return
    this.started = true
    this.audio.volume = 0
    this.audio.play().catch(() => (this.missing = true))
  }

  update(dt: number) {
    if (!this.started || this.missing) return
    this.level += (1 - this.level) * damp(0.5, dt)
    this.audio.volume = this.level * this.volume
  }
}
