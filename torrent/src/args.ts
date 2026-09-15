// CLI options for one pear.
//
//   pnpm pear                                    # room "pears", name from coordinator
//   pnpm pear -- --room lab                      # another room
//   pnpm pear -- --coordinator                   # be the coordinator from t=0
//   pnpm pear -- --index 3                       # pin PEAR_NAMES[3]
//   pnpm pear -- --name aman --auto-join credit-assignment
//
// Legacy positional form is still accepted: <room> <name> <auto-join>.

import { PEAR_NAMES } from './data.ts'
import { DEFAULT_ROOM, flagString, parseFlags } from './room.ts'

export interface PearOptions {
  room: string
  name: string | null // fixed by --name/--index; null → assigned by the coordinator
  autoJoin: string | null
  coordinator: boolean
}

export function parsePearArgs(argv: string[]): PearOptions {
  const f = parseFlags(argv, ['coordinator'])
  const [room, posName, posJoin] = f.positional
  const index = Number(flagString(f, 'index', 'NaN'))
  const indexed = Number.isInteger(index) && index >= 0 ? PEAR_NAMES[index % PEAR_NAMES.length] : null
  const flagName = flagString(f, 'name', posName ?? '') || null
  return {
    room: flagString(f, 'room', room ?? DEFAULT_ROOM),
    name: indexed ?? flagName,
    autoJoin: flagString(f, 'auto-join', posJoin ?? '') || null,
    coordinator: f.opts.coordinator === true,
  }
}
