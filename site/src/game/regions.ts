// The compressed Greece: where everything is. Coordinates are world units,
// x east, z south; the sea is at y = 0. Terrain shape comes from BLOBS,
// rivers and pools carve it, and the rest is placed on top.

export type Form = 'human' | 'owl' | 'naiad' | 'stag'

export interface Region {
  id: string
  name: string
  x: number
  z: number
  r: number
  tint: number
  ovid: string // a line from the Metamorphoses (A. S. Kline's translation)
  book: string
}

export const REGIONS: Region[] = [
  { id: 'nonacris', name: 'Nonacris, Arcadia', x: -150, z: -120, r: 75, tint: 0x6f8f4a, ovid: 'Often, as he came and went, he would stop short at the sight of a girl from Nonacris, feeling the fire take in the very marrow of his bones.', book: 'Book II' },
  { id: 'delphi', name: 'Delphi, Parnassus', x: 0, z: -160, r: 65, tint: 0xa8a394, ovid: 'Mount Parnassus lifts its twin steep summits to the stars, its peaks above the clouds.', book: 'Book I' },
  { id: 'thebes', name: 'Thebes, Boeotia', x: 60, z: -40, r: 65, tint: 0x8aa04e, ovid: 'Go where she leads, and where she finds rest on the grass build the walls of Thebes, your city, and call the land Boeotia.', book: 'Book III' },
  { id: 'corinth', name: 'Corinth', x: 0, z: 60, r: 55, tint: 0xb3a86a, ovid: 'At last, the dragon\'s wings brought her to Corinth, the ancient Ephyre, and its Pirenian spring.', book: 'Book VII' },
  { id: 'crete', name: 'Crete', x: 0, z: 190, r: 70, tint: 0xa9a15c, ovid: 'The sky is surely open to us: we will go that way: Minos rules everything but he does not rule the heavens.', book: 'Book VIII' },
  { id: 'thrace', name: 'Thracian coast', x: 150, z: -150, r: 65, tint: 0x5f7f5a, ovid: 'And now, carried onward to the sea, they left their native river-mouth and reached the shores of Lesbos, at Methymna.', book: 'Book XI' },
]

export const REGION_ORDER = REGIONS.map((r) => r.id)

// For the open sea and the sky between the regions.
export const SEA_OVID = {
  ovid: 'Far from his own country, in a distant part of the world, the river god Eridanus takes him from the air, and bathes his smoke-blackened face.',
  book: 'Book II',
}

export interface Blob {
  x: number
  z: number
  r: number
  h: number
}

export const BLOBS: Blob[] = [
  { x: -150, z: -120, r: 75, h: 42 },
  { x: 0, z: -160, r: 65, h: 58 },
  { x: 60, z: -40, r: 65, h: 14 },
  { x: 0, z: 60, r: 55, h: 16 },
  { x: 0, z: 190, r: 70, h: 26 },
  { x: 150, z: -150, r: 65, h: 32 },
  { x: 30, z: -10, r: 95, h: 9 }, // mainland between Delphi, Thebes and Corinth
  { x: -80, z: -140, r: 70, h: 26 }, // Arcadia–Parnassus ridge
  { x: 110, z: -100, r: 70, h: 10 }, // Boeotia–Thrace link
  { x: 100, z: -5, r: 28, h: 20 }, // Mount Cithaeron
  { x: 12, z: 45, r: 14, h: 30 }, // Acrocorinth
  { x: 215, z: -80, r: 28, h: 12 }, // Lesbos
  { x: 85, z: 165, r: 12, h: 7 }, // Delos
  { x: 130, z: 145, r: 12, h: 8 }, // Paros
  { x: 185, z: 115, r: 16, h: 9 }, // Icaria
]

// Corinth's two seas: everything beyond |x| > 38 between these z values is carved out.
export const ISTHMUS = { halfWidth: 38, z0: 25, z1: 105, depth: 22 }

export type Polyline = Array<[number, number]>

export const RIVERS: Record<string, Polyline> = {
  ladon: [
    [-150, -105],
    [-165, -90],
    [-152, -62],
    [-136, -32],
    [-124, -2],
  ],
  hebrus: [
    [150, -150],
    [175, -140],
    [195, -120],
    [218, -110],
  ],
}

export interface Pool {
  id: string
  x: number
  z: number
  r: number
  spring?: string // id of the pool a naiad surfaces at
  y?: number // filled in by terrain.ts
}

export const POOLS: Pool[] = [
  { id: 'nonacris-spring', x: -150, z: -105, r: 7, spring: 'ladon-hidden' },
  { id: 'ladon-hidden', x: -178, z: -140, r: 6, spring: 'nonacris-spring' },
  { id: 'castalian', x: 10, z: -150, r: 6, spring: 'thebes-fountain' },
  { id: 'thebes-fountain', x: 60, z: -40, r: 5, spring: 'castalian' },
  { id: 'corinth-fountain', x: 0, z: 60, r: 5, spring: 'crete-fountain' },
  { id: 'crete-fountain', x: 0, z: 190, r: 5, spring: 'corinth-fountain' },
  { id: 'lesbos-pool', x: 215, z: -86, r: 5 },
]

export interface TransformPoint {
  x: number
  z: number
  form: Form
  kind: 'spring' | 'shrine' | 'grove' | 'pool'
}

export const TRANSFORMS: TransformPoint[] = [
  { x: -150, z: -105, form: 'naiad', kind: 'spring' },
  { x: -130, z: -138, form: 'stag', kind: 'grove' },
  { x: 0, z: -150, form: 'owl', kind: 'shrine' },
  { x: 60, z: -40, form: 'naiad', kind: 'pool' },
  { x: -28, z: 96, form: 'naiad', kind: 'pool' },
  { x: 0, z: 190, form: 'owl', kind: 'shrine' },
  { x: 150, z: -165, form: 'stag', kind: 'grove' },
  { x: 215, z: -86, form: 'naiad', kind: 'pool' },
]

export interface Memory {
  region: string
  x: number
  z: number
  lift: number // metres above ground
  text: string
}

export const MEMORIES: Memory[] = [
  { region: 'nonacris', x: -178, z: -140, lift: 0.8, text: 'Cold water, and a voice counting waterfalls. You were small.' },
  { region: 'delphi', x: 0, z: -168, lift: 7, text: 'The oracle said nothing. The stars did the talking.' },
  { region: 'thebes', x: 100, z: -5, lift: 1, text: 'Leaves that glowed. Someone ran beside you who was not yet a stag.' },
  { region: 'corinth', x: 12, z: 42, lift: 1, text: 'Two seas at once, and the cart singing on the rails.' },
  { region: 'crete', x: 185, z: 115, lift: 1, text: 'Wax, feathers, a warm updraft. A father shouting, far below.' },
  { region: 'thrace', x: 215, z: -80, lift: 1, text: 'A song across the water. It knew your old name.' },
]

export interface Thermal {
  x: number
  z: number
  r: number
}

export const THERMALS: Thermal[] = [
  { x: 55, z: 178, r: 16 },
  { x: 108, z: 155, r: 16 },
  { x: 158, z: 130, r: 16 },
]

export interface Track {
  id: string
  points: Polyline
}

export const TRACKS: Track[] = [
  { id: 'nonacris', points: [[-146, -114], [-134, -100], [-124, -82], [-110, -70], [-96, -56], [-82, -50]] },
  { id: 'corinth', points: [[-6, 96], [10, 82], [26, 66], [22, 52], [13, 45]] },
]

export interface Npc {
  region: string
  name: string | null // null → next name from names.ts
  x: number
  z: number
  lines: string[]
}

export const NPCS: Npc[] = [
  { region: 'nonacris', name: null, x: -144, z: -122, lines: ['The Ladon starts under the falls.', 'Springs remember who went in.'] },
  { region: 'nonacris', name: 'a plane tree', x: -128, z: -134, lines: ['I remember hooves.', 'Stand here and ask to run.'] },
  { region: 'delphi', name: 'the Pythia', x: -4, z: -152, lines: ['Look up. The roads are drawn in stars.', 'Wings first. Then the rest.'] },
  { region: 'thebes', name: null, x: 64, z: -46, lines: ['The fountain echoes twice.', 'Cithaeron keeps a trail only stags can see.'] },
  { region: 'corinth', name: null, x: 2, z: 92, lines: ['The cart goes up. Bring a brake.', 'From the rock you see both seas.'] },
  { region: 'crete', name: 'Daedalus', x: 4, z: 186, lines: ['Islands are resting places. Use them.', 'Not too high. Not too low.'] },
  { region: 'thrace', name: 'Orpheus', x: 154, z: -156, lines: ['Follow the water. Everything downhill is mine.', 'Lesbos is listening.'] },
]

// The sky river, revealed once every memory is found. Its source is the last point.
export const ERIDANUS: Array<[number, number, number]> = [
  [200, 70, -120],
  [150, 85, -150],
  [70, 105, -165],
  [0, 110, -170],
  [-80, 95, -150],
  [-150, 80, -120],
]

export const START = { x: -150, z: -120 }
