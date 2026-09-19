// Changing Shores: the canvas is the Engine's; React draws the HUD from the
// snapshots it sends up.

import { useEffect, useRef, useState } from 'react'
import { Controls } from './game/controls.ts'
import { Engine, type HudState } from './game/engine.ts'
import { CartGauge, Dialogue, Help, MapOverlay, MobileControls, Notice, Prompt, Status } from './hud.tsx'
import './App.css'

const INITIAL: HudState = {
  region: 'Nonacris, Arcadia',
  ovid: '',
  book: '',
  form: 'human',
  prompt: null,
  dialogue: null,
  cart: null,
  mapOpen: false,
  complete: false,
  playerMap: { x: 0, z: 0 },
}

function App() {
  const mount = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const [hud, setHud] = useState<HudState>(INITIAL)
  const [controls] = useState(() => new Controls())

  useEffect(() => {
    const e = new Engine(mount.current!, controls, setHud)
    engine.current = e
    e.start()
    return () => e.dispose()
  }, [controls])

  return (
    <div className="game">
      <div ref={mount} className="canvas" />
      <Status hud={hud} />
      <CartGauge hud={hud} />
      <Prompt hud={hud} />
      <Dialogue hud={hud} />
      <MapOverlay hud={hud} />
      <Notice hud={hud} onRestart={() => engine.current?.restart()} />
      <MobileControls controls={controls} />
      <Help />
    </div>
  )
}

export default App
