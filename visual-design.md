# Metamorphoses

Create a playable browser-based 3D exploration game using Three.js, inspired by Ovid’s *Metamorphoses*. Use a single HTML/JS file or minimal files. The player begins as a human in miniature mythic Greece, discovering overlapping routes by walking, carting, flying and swimming. Each transformation changes movement physics, camera behaviour, sound, environmental perception and accessible paths.

### implementation edits:
- music always plays. no white noise needed
- the upper left corner only gives a definition faithful to Ovid's metamorphosis from poetryintranslation.com/PITBR/Latin/Metamorph.php no additional text instructions
- player can switch between walking and flying at any point. swimming is only available in water. different modes correspond to different shapes
- no instruction on the upper right corner.
- other humans can appear in the browser as different laptops connect as compute.
- the flying logic: direction matches the current view point angle, rather than adjusting when user presses "w"

### sound files
possible files:
greek seaside, play when a certain scale of zoom out, or when the player is certain distance from the sea: https://youtu.be/ZrrKGnMoRWM?si=SNuYWwP8pr-dJ7su
music: age of mythology, greek soundtrack
- byzantine empire music https://www.youtube.com/watch?v=lBRIy9tLp_8

## Forms and travel

- **Human:** walk through towns, speak with inhabitants and ride wooden mountain carts. Give carts smooth acceleration, braking, inertia and cornering roll, with the satisfying movement of Zelda’s mine carts.
- **Owl:** fly freely, bank, glide on thermals, cross ravines and perch on roofs or columns. Reveal hidden landmarks at night; widen the camera and show currents through drifting seeds.
- **Naiad:** become a freshwater spirit, swim with currents, enter submerged passages and emerge from connected springs or fountains. Use fluid steering, luminous water trails and a camera that follows river bends.
- **Stag:** run swiftly through forests and mountain paths, leap obstacles and sense hidden woodland trails. Use springy movement and subtle tracks or glowing leaves as guides.
- **Optional dolphin:** unlock open-sea swimming after the main forms work. Required destinations must remain accessible without it.

Transform at springs, shrines, groves and shoreline pools. Briefly rearrange feathers, leaves, water or stars around the character; blend cameras smoothly and ensure safe placement. Unlock the main forms early. Each should reveal shortcuts through familiar places.

## World

Build one compact landscape with recognizable regional silhouettes and visible connections between roads, rivers, air currents and sea. Compress geography deliberately.

- **Nonacris, Arcadia:** opening mountain settlement above cold green waterfalls and springs; forest roads, steep cart tracks and remote pastoral groves. Include the Ladon as a named waterway.
- **Delphi and Mount Parnassus:** high sanctuary with marble terraces, cypresses, mist, bronze tripods and the Castalian spring. The oracle reveals destinations as constellations aligned with the landscape.
- **Thebes, Boeotia:** walled town with gates, fountains, courtyards and fields leading toward wooded Mount Cithaeron. Include strange reflections, echoes and traces of transformations.
- **Corinth:** bright isthmus town between two seas, with harbours, bridges, stone stairs, sweeping cart tracks and an Acrocorinth lookout.
- **Crete and the Icarian route:** Daedalus’s workshop, olive trees and intricate courtyards. A beautiful flight sequence passes distant Delos and Paros toward Icaria, with thermals and safe resting places.
- **Thracian coast and Lesbos:** cooler, windier late-game region; follow a mountain river to the Aegean, then sea or air routes to Mytilene. Music travels faintly across the water.
- **Eridanus:** an impossible luminous river revealed by progress, flowing across the sky or through mountains. Make its entrance legible while its geometry feels supernatural.

Use Tempe as an optional additional valley. Treat invented connections and quests as poetic adaptations of Ovid.

## Play and atmosphere

Create a complete short adventure: explore, transform, discover a route and recover one memory in each of the six ordinary regions. Collecting them reveals Eridanus; reaching its source completes the journey and permits continued exploration. Use small movement puzzles, brief conversations and nearby recovery points. Never strand the player in an incompatible form.

Sample earlier user-provided names for original inhabitants through an editable name list; keep mythological figures distinct. Dialogue should be brief and strange: a tree remembers, a spring answers, a bird repeats a forgotten conversation.

At Daedalus’s workshop, optionally offer isometric cart customization with a green canopy, bronze lantern, luggage basket and carved feather ornament. Show changes on the cart.

## Presentation and implementation

Warm, polished low-poly art: limestone, terracotta roofs, olive green, turquoise sea, dusk lavender, soft shadows, mist, warm windows and restrained particles. Use wind, wingbeats, hooves, flowing water and cart sounds. Keep the tone wondrous and occasionally melancholy.

Minimal UI: region, form, objective, memory count and contextual prompts; speed and braking appear only in carts. Controls: WASD/arrows to move, Space for jump/flap/ascent, Shift to descend, E to interact, Q to transform at valid locations and M for the map. In carts, W accelerates and S brakes. Include mobile movement and contextual buttons.

Use procedural geometry, curved cart tracks, frame-rate-independent movement, collision, smooth camera transitions, fall recovery, responsive resizing, restart and local saving where available. Keep free flight and walking independent of tracks. Start audio after interaction. If Three.js loads from a pinned CDN, state the internet requirement. Follow repository function and file limits, splitting into minimal files when needed. Deliver runnable code with all four main forms and playable versions of every required region before optional features.
