// Keyboard, mouse and touch input, read once per frame. Held keys are state,
// key presses are edge-triggered, mouse motion and wheel are accumulated and
// handed over as deltas.

export interface Input {
  forward: number // -1..1 (W/S, joystick)
  turn: number // -1..1 (A/D, joystick)
  up: boolean // Space
  down: boolean // Shift
  interact: boolean // E, one-shot
  transform: boolean // Q, one-shot
  map: boolean // M, one-shot
  any: boolean // anything at all this frame, to start audio
  look: { dx: number; dy: number } // left button drag, pixels
  pan: { dx: number; dy: number } // middle button drag, pixels
  zoom: number // wheel, positive = away
  dragging: boolean
}

const KEYS: Record<string, string> = {
  KeyW: 'w',
  ArrowUp: 'w',
  KeyS: 's',
  ArrowDown: 's',
  KeyA: 'a',
  ArrowLeft: 'a',
  KeyD: 'd',
  ArrowRight: 'd',
  Space: 'space',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  KeyE: 'e',
  KeyQ: 'q',
  KeyM: 'm',
}

export class Controls {
  private held = new Set<string>()
  private pressed = new Set<string>()
  private touched = false
  private button: number | null = null
  private modified = false // a modifier rode along with the middle button
  private look = { dx: 0, dy: 0 }
  private pan = { dx: 0, dy: 0 }
  private zoom = 0
  joystick = { x: 0, y: 0 }
  private onDown = (e: KeyboardEvent) => this.onKey(e, true)
  private onUp = (e: KeyboardEvent) => this.onKey(e, false)
  private onBlur = () => this.held.clear()
  private onMouseDown = (e: MouseEvent) => this.mouseDown(e)
  private onMouseUp = () => (this.button = null)
  private onMouseMove = (e: MouseEvent) => this.mouseMove(e)
  private onWheel = (e: WheelEvent) => this.wheel(e)
  private onAux = (e: MouseEvent) => e.preventDefault()

  bind(surface: HTMLElement) {
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
    window.addEventListener('blur', this.onBlur)
    surface.addEventListener('mousedown', this.onMouseDown)
    surface.addEventListener('auxclick', this.onAux)
    surface.addEventListener('contextmenu', this.onAux)
    surface.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('mousemove', this.onMouseMove)
  }

  unbind(surface: HTMLElement) {
    window.removeEventListener('keydown', this.onDown)
    window.removeEventListener('keyup', this.onUp)
    window.removeEventListener('blur', this.onBlur)
    surface.removeEventListener('mousedown', this.onMouseDown)
    surface.removeEventListener('auxclick', this.onAux)
    surface.removeEventListener('contextmenu', this.onAux)
    surface.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = KEYS[e.code]
    if (!k) return
    if (e.target instanceof HTMLInputElement) return
    e.preventDefault()
    if (down && !this.held.has(k)) this.pressed.add(k)
    if (down) this.held.add(k)
    else this.held.delete(k)
    this.touched = true
  }

  // Blender's viewport: the middle button alone orbits, with Shift it pans,
  // with Ctrl it zooms; the wheel zooms too. The left button is not a camera.
  private mouseDown(e: MouseEvent) {
    if (e.button !== 1) return
    e.preventDefault()
    this.button = 1
    this.touched = true
  }

  private mouseMove(e: MouseEvent) {
    if (this.button !== 1) return
    this.modified = e.shiftKey || e.ctrlKey
    if (e.shiftKey) {
      this.pan.dx += e.movementX
      this.pan.dy += e.movementY
    } else if (e.ctrlKey) this.zoom += e.movementY * 4
    else {
      this.look.dx += e.movementX
      this.look.dy += e.movementY
    }
  }

  private wheel(e: WheelEvent) {
    e.preventDefault()
    this.zoom += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    this.touched = true
  }

  // Touch buttons call these with the same key names.
  press(key: string, down: boolean) {
    if (down && !this.held.has(key)) this.pressed.add(key)
    if (down) this.held.add(key)
    else this.held.delete(key)
    this.touched = true
  }

  read(): Input {
    const h = this.held
    const axis = (pos: string, neg: string) => (h.has(pos) ? 1 : 0) - (h.has(neg) ? 1 : 0)
    // Shift held for a pan is not a request to descend.
    const panning = this.button === 1 && this.modified
    const input: Input = {
      forward: axis('w', 's') || -this.joystick.y,
      turn: axis('d', 'a') || this.joystick.x,
      up: h.has('space'),
      down: h.has('shift') && !panning,
      interact: this.pressed.has('e'),
      transform: this.pressed.has('q'),
      map: this.pressed.has('m'),
      any: this.touched,
      look: { ...this.look },
      pan: { ...this.pan },
      zoom: this.zoom,
      dragging: this.button !== null,
    }
    this.pressed.clear()
    this.look = { dx: 0, dy: 0 }
    this.pan = { dx: 0, dy: 0 }
    this.zoom = 0
    this.touched = this.touched || this.joystick.x !== 0 || this.joystick.y !== 0
    return input
  }
}
