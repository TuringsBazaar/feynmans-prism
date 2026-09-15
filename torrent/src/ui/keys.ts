// Keyboard handling. Two modes: browsing the problem list, or composing a
// message. Returns nothing; mutates `ui`/`self` and notifies the store.

import type { Key } from 'ink'
import { PROBLEMS } from '../data.ts'
import { shutdown } from '../lifecycle.ts'
import { join, leave, say } from '../presence.ts'
import { notify, self, ui } from '../state.ts'

export function handleKey(input: string, key: Key, exit: () => void) {
  if (ui.composing) composeKey(input, key)
  else browseKey(input, key, exit)
}

function composeKey(input: string, key: Key) {
  if (key.return) {
    say(ui.draft)
    ui.draft = ''
    ui.composing = false
  } else if (key.escape) {
    ui.draft = ''
    ui.composing = false
  } else if (key.backspace || key.delete) {
    ui.draft = ui.draft.slice(0, -1)
  } else if (input && !key.ctrl && !key.meta) {
    ui.draft += input
  }
  notify()
}

function browseKey(input: string, key: Key, exit: () => void) {
  const p = PROBLEMS[ui.cursor]
  if (key.downArrow || input === 'j') ui.cursor = Math.min(ui.cursor + 1, PROBLEMS.length - 1)
  else if (key.upArrow || input === 'k') ui.cursor = Math.max(ui.cursor - 1, 0)
  else if (key.return) toggle(ui.expanded, p.id)
  else if (input === ' ') {
    if (self.joined.has(p.id)) leave(p.id)
    else join(p.id)
  } else if (input === 'm') {
    ui.composing = true
    ui.draft = ''
  } else if (input === 'q') {
    exit()
    void shutdown()
  }
  notify()
}

function toggle(set: Set<string>, id: string) {
  if (!set.delete(id)) set.add(id)
}
