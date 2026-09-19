// Minimal UI over the canvas, in ivory panels: the place with its line from
// Ovid, prompts, dialogue, the cart gauge, the map and touch controls.

import { useEffect, useRef } from 'react'
import type { HudState } from './game/engine.ts'
import type { Controls } from './game/controls.ts'
import { REGIONS } from './game/regions.ts'
import { mapImage, toMap } from './game/terrain.ts'

// Only the place and Ovid's line on it (A. S. Kline's translation).
export function Status({ hud }: { hud: HudState }) {
  return (
    <div className="status panel">
      <div className="region">{hud.region}</div>
      <div className="ovid">{hud.ovid}</div>
      <div className="label">Ovid, Metamorphoses {hud.book} · tr. A. S. Kline</div>
    </div>
  )
}

export function Prompt({ hud }: { hud: HudState }) {
  if (!hud.prompt) return null
  return (
    <div className="prompt panel">
      <kbd>{hud.prompt.key}</kbd> {hud.prompt.text}
    </div>
  )
}

export function Dialogue({ hud }: { hud: HudState }) {
  if (!hud.dialogue) return null
  return (
    <div className="dialogue panel">
      <b>{hud.dialogue.name}</b> — {hud.dialogue.text}
    </div>
  )
}

export function CartGauge({ hud }: { hud: HudState }) {
  if (!hud.cart) return null
  return (
    <div className="cart">
      <div className="speed panel">
        {Math.round(hud.cart.speed * 3.6)}
        <small>km/h</small>
      </div>
      <div className="pedal power">
        <div className="label">hold to glide</div>
        <b>Power</b> <kbd>W</kbd>
      </div>
      <div className={hud.cart.braking ? 'pedal brake on' : 'pedal brake'}>
        <div className="label">easy and gentle</div>
        <b>Brake</b> <kbd>S</kbd>
      </div>
    </div>
  )
}

const MAP = 256

export function MapOverlay({ hud }: { hud: HudState }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raster = useRef<ImageData | null>(null)
  useEffect(() => {
    if (!hud.mapOpen || !ref.current) return
    const ctx = ref.current.getContext('2d')!
    raster.current ??= mapImage(MAP)
    ctx.putImageData(raster.current, 0, 0)
    ctx.font = '11px system-ui'
    ctx.fillStyle = '#2f3a30'
    for (const r of REGIONS) ctx.fillText(r.name.split(',')[0], toMap(r.x, MAP) - 20, toMap(r.z, MAP))
    ctx.fillStyle = '#d4835a'
    ctx.beginPath()
    ctx.arc(toMap(hud.playerMap.x, MAP), toMap(hud.playerMap.z, MAP), 4, 0, Math.PI * 2)
    ctx.fill()
  }, [hud.mapOpen, hud.playerMap])
  if (!hud.mapOpen) return null
  return <canvas ref={ref} className="map" width={MAP} height={MAP} />
}

export function Notice({ hud, onRestart }: { hud: HudState; onRestart: () => void }) {
  return (
    <div className={hud.cart ? 'notice shifted' : 'notice'}>
      {hud.complete ? <span>Eridanus reached. </span> : null}
      <button type="button" onClick={onRestart}>
        restart
      </button>
    </div>
  )
}

export function Help() {
  return (
    <div className="help panel">
      <kbd>WASD</kbd>move <kbd>Space</kbd>up/jump <kbd>Shift</kbd>down <kbd>E</kbd>interact{' '}
      <kbd>M</kbd>map · <kbd>Q</kbd>walk/fly · <kbd>MMB</kbd>drag orbits <kbd>Shift</kbd>+drag pans <kbd>Ctrl</kbd>+drag or scroll zooms
    </div>
  )
}

function Joystick({ controls }: { controls: Controls }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!
    const move = (e: TouchEvent) => {
      const t = e.touches[0]
      const r = el.getBoundingClientRect()
      const x = (t.clientX - (r.left + r.width / 2)) / (r.width / 2)
      const y = (t.clientY - (r.top + r.height / 2)) / (r.height / 2)
      controls.joystick = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }
      e.preventDefault()
    }
    const end = () => (controls.joystick = { x: 0, y: 0 })
    el.addEventListener('touchstart', move, { passive: false })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    return () => {
      el.removeEventListener('touchstart', move)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
    }
  }, [controls])
  return <div ref={ref} className="joystick" />
}

const BUTTONS: Array<[string, string]> = [
  ['space', '▲'],
  ['shift', '▼'],
  ['e', 'E'],
  ['q', 'Q'],
  ['m', 'M'],
]

export function MobileControls({ controls }: { controls: Controls }) {
  return (
    <div className="mobile">
      <Joystick controls={controls} />
      <div className="buttons">
        {BUTTONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onTouchStart={() => controls.press(key, true)}
            onTouchEnd={() => controls.press(key, false)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
