// CLI options for one pear.
//
//   pnpm pear                                    # room "pears", device name from identity.json
//   pnpm pear -- --room lab                      # another room
//   pnpm pear -- --coordinator                   # be the coordinator from t=0
//   pnpm pear -- --index 3                       # pin DEVICE_NAMES[3]
//   pnpm pear -- --name Eridanus --auto-join credit-assignment
//   pnpm pear -- --local                         # loopback only, ignore the tailnet
//   pnpm pear -- --home .pears/2                 # identity dir (default ~/.feynman)
//
// Legacy positional form is still accepted: <room> <name> <auto-join>.

import { DEVICE_NAMES } from './data.ts'
import { defaultHome } from './identity.ts'
import { DEFAULT_ROOM, flagString, parseFlags } from './room.ts'

export interface PearOptions {
  room: string
  name: string | null // fixed by --name/--index; null → the device name in identity.json
  autoJoin: string | null
  coordinator: boolean
  local: boolean
  home: string
}

export function parsePearArgs(argv: string[]): PearOptions {
  const f = parseFlags(argv, ['coordinator', 'local'])
  const [room, posName, posJoin] = f.positional
  const index = Number(flagString(f, 'index', 'NaN'))
  const indexed = Number.isInteger(index) && index >= 0 ? DEVICE_NAMES[index % DEVICE_NAMES.length] : null
  const flagName = flagString(f, 'name', posName ?? '') || null
  return {
    room: flagString(f, 'room', room ?? DEFAULT_ROOM),
    name: indexed ?? flagName,
    autoJoin: flagString(f, 'auto-join', posJoin ?? '') || null,
    coordinator: f.opts.coordinator === true,
    local: f.opts.local === true,
    home: flagString(f, 'home', defaultHome()),
  }
}
