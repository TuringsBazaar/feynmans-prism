// Wire format shared by every room client (pear, guillefix.cjs, message,
// transcript, agent). Newline-framed, one message per line:
//
//   chat     "[name] text"           plain text, human readable
//   control  "\u001f" + JSON         hello/join/leave/name protocol (pear only)
//
// Anything that is neither is untagged chat from that peer. Pure functions
// only — no I/O — so this module is safe to import from tests and scripts.

// Control lines start with the ASCII "unit separator" so plain-text clients
// can skip them with one check.
export const CONTROL_PREFIX = '\u001f'

export const CHAT_TAG = /^\[([^\]]+)\]\s?(.*)$/s

export type Control =
  | { t: 'hello'; name: string | null; joined: string[]; coordinator: boolean; since: number }
  | { t: 'rename'; name: string }
  | { t: 'join'; name: string; problemId: string }
  | { t: 'leave'; name: string; problemId: string }
  | { t: 'request-name' } // member → coordinator
  | { t: 'assign'; name: string } // coordinator → member
  | { t: 'compute-provide'; computeUnits: number; role: 'provider' | 'researcher' | 'hybrid' } // peer announces compute
  | { t: 'submit-fragment'; problemId: string; subproblemId: string; content: string } // peer submits solution
  | { t: 'report-velocity'; fragmentId: string; amplificationFactor: number } // peer reports downstream speedup
  | { t: 'assign-fragment'; problemId: string; subproblemId: string } // peer announces assignment pickup
  | { t: 'chat'; from: string; text: string } // broadcasted message (for Discord stirring)

export type ControlOf<T extends Control['t']> = Extract<Control, { t: T }>

export interface Chat {
  from: string | null // null when the line carried no "[name]" tag
  text: string
}

export function isControl(raw: string): boolean {
  return raw.startsWith(CONTROL_PREFIX)
}

export function encodeControl(msg: Control): string {
  return CONTROL_PREFIX + JSON.stringify(msg) + '\n'
}

export function encodeChat(name: string, text: string): string {
  return `[${name}] ${text}\n`
}

// Accept both sigil-prefixed and bare JSON control lines; anything else is chat.
export function parseControl(raw: string): (Partial<Control> & { t: string }) | null {
  const body = raw.startsWith(CONTROL_PREFIX) ? raw.slice(1) : raw
  if (!body.startsWith('{')) return null
  try {
    const m = JSON.parse(body)
    return m && typeof m.t === 'string' ? m : null
  } catch {
    return null
  }
}

// Returns null for blank lines so callers can drop them in one step.
export function parseChat(raw: string): Chat | null {
  const m = CHAT_TAG.exec(raw)
  if (m) return { from: m[1], text: m[2] }
  const text = raw.trim()
  return text ? { from: null, text } : null
}
