// Local save: what was found, what you can become, where you were.

import type { Form } from './regions.ts'

export interface SaveData {
  memories: string[]
  form: Form
  x: number
  y: number
  z: number
}

const KEY = 'changing-shores'

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SaveData) : null
  } catch {
    return null
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // private mode or storage blocked: the game still runs, it just forgets
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
