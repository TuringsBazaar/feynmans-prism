// Short synthesized cues; the music itself is an audio file (music.ts).

export class GameAudio {
  private ctx: AudioContext | null = null

  start() {
    this.ctx ??= new AudioContext()
  }

  private blip(freq: number, seconds: number, gain: number, type: OscillatorType) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    env.gain.setValueAtTime(gain, this.ctx.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + seconds)
    osc.connect(env).connect(this.ctx.destination)
    osc.start()
    osc.stop(this.ctx.currentTime + seconds)
  }

  chime() {
    this.blip(880, 0.9, 0.12, 'sine')
    this.blip(1320, 1.2, 0.06, 'sine')
  }
}
