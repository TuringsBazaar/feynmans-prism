# Changing Shores

The visuals site for feynman's prism: a small low-poly Three.js exploration
game after Ovid's *Metamorphoses*, laid out in [visual-design.md](../visual-design.md).
The regions are the pears' device names — Nonacris, Corinth, Eridanus,
Mytilene — so the network and the game share one map.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dist/, static; deploy anywhere (Cloudflare Pages/Workers assets)
pnpm lint       # oxlint, same 35-line / 300-line limits as the torrent
```

Controls: WASD/arrows move · Space jump/flap/ascend · Shift descend/dive ·
E interact · Q transform at springs, shrines, groves and pools · M map.
Mouse, as in Blender: hold the middle button and drag to orbit, Shift +
middle drag to pan, Ctrl + middle drag or the scroll wheel to zoom. The left
button does nothing to the camera. Standing still, an orbit is free; once you
walk, you walk the way you are looking, so orbiting while moving steers. In
a cart, W accelerates and S brakes. Touch: joystick and buttons.

Music: `public/music/ambience.mp3` loops from the first input on
(`src/game/music.ts`); there are no synthesized noise beds. The file is yours
to supply (use one you hold rights to; the Age of Mythology Greek seaside
theme is the reference mood), and it is worth keeping small.

Look: golden hour after the Cloudline references in `src/assets/` — gradient
sky with a soft sun that turns to a moon and stars for the owl, drifting
low-poly clouds, sparkle on a pale turquoise sea, cream walls with terracotta
roofs, green shutters and warm windows, rails on wooden sleepers with trestles,
a tram-green cart, ivory rounded panels with small-caps labels and serif
place names (`src/game/sky.ts`, `props.ts`, `track.ts`, `App.css`).

Play: start human in Nonacris. Q changes shape anywhere — on land walk, run
(stag), fly (owl); in water you are a naiad and Q toggles to the owl. Wading
into water turns you into a naiad, climbing out turns you back. One memory
hides in each of the six regions, each behind a different way of moving;
finding all six reveals Eridanus across the sky, and its source ends the
journey. Progress is saved in `localStorage` (restart button clears it).
Inhabitants take their names from `src/names.ts`.

The panel in the corner shows only the place and Ovid's line on it, from
A. S. Kline's translation at poetryintranslation.com (Books I, II, III, VII,
VIII, XI; the passages live in `src/game/regions.ts`). Kline licenses the
text for non-commercial reproduction with attribution, which the panel
carries; keep that in mind if the site ever turns commercial.

Layout: `src/App.tsx` is the shell, `src/hud.tsx` the overlay, and
`src/game/` the engine — `regions.ts` (all the data: where things are),
`terrain.ts` (the landscape as a height function), `props.ts` (builders and
region dressing), `player.ts` (the four forms), `cart.ts`, `interactions.ts`
(E and Q), `engine.ts` (loop, camera, atmosphere), plus `audio`, `particles`,
`eridanus`, `controls`, `save`, `noise`.
