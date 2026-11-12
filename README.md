# EMBERFALL — The Ashen Vow

An original side-scrolling brawler in the classic arcade style. All characters,
stages, effects and sounds are procedural and original. No external assets, no
dependencies, no build step.

## Run
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`).

## Controls
| Action | Keys |
|---|---|
| Move | WASD / arrows |
| Attack (3-hit combo) | J or Z |
| Jump | K, X or Space |
| Dive strike | Jump, then J |
| Ember Burst (60 mana) | L or C |
| CRT filter | F |
| Mute | M |

## Graphics pipeline
1. 480x270 pixel scene: five parallax layers (sky and clouds, far castles with lit windows, dead trees, banner-hung colonnade, flagstone floor with per-tile shading), drifting fog, foreground pillars
2. Dynamic lighting: a darkness mask with torch, hero, enemy and spark lights punched out of it, with flicker
3. Additive particles (sparks, embers, dust), swing trails, hit-stop and screen shake
4. WebGL post-process: barrel curvature, bloom, scanlines, aperture grille, vignette, chromatic aberration

## Roadmap
- Optional: swap the code-drawn fighters (`drawHuman`) for hand-made sprite sheets
- More stages, two-player co-op, gamepad and touch controls
- Music, and more enemy types and boss phases

## Art notes
Fighters are drawn from layered, cel-shaded shapes (highlight, base and shadow tones),
then stamped with a 1px dark outline for a chunky 16-bit look. Weapons, helms, capes,
pauldrons and ember cracks differ per enemy type. Everything is original.
