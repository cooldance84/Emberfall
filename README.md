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
| Dive strike | Jump, then J (on foot) |
| Flame breath | J while riding |
| Dragon's Wrath (60 mana) | Shift (or L / C) |
| Ride a wyrmling | K while standing next to a free one |
| Dismount | E |
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

## Mounts, jars and Dragon's Wrath
- **Wyrmlings:** some Ashen Husks arrive riding small ember dragons (faster, hit harder). Knock the rider off (a heavy hit or three hits) and the wyrmling is free: stand next to it and press K to ride. Riding gives speed, J breathes fire, and the wyrmling soaks hits for you until its health bar runs out.
- **Pilferers:** a small green imp runs across the screen now and then carrying an ember jar. Hit it and it drops the jar and bolts. Pick jars up (max 3).
- **Dragon's Wrath (Shift):** costs a full 60 mana (filled by landing hits). Storm clouds roll in, a giant dragon head descends and smashes the arena, damaging every enemy on the map (off-screen too), for 130 damage. Each jar you carry adds +15% (1 jar +15%, 2 jars +30%, 3 jars +45%) and makes the dragon bigger. Jars are spent on cast. Regular enemies die outright; the boss takes the hit but survives.

## Story & campaign

*The Ashen Vow*: the Cinder King stole the Heart-Ember and the world went dark. Play Kestrel, the last Ember Warden, through four stages, each with its own look and its own boss:

| Stage | Boss | Gimmick |
|---|---|---|
| 1. The Broken Gate | Cinder Colossus | Heavy bruiser, enrages below 50% HP |
| 2. The Sunken Marsh | Mire Matron | Kites you, fires spirit orbs, summons husks |
| 3. The Ember Forge | Forgemaster | Hammer smashes with shockwaves, charge, quake rings (jump them) |
| 4. The Obsidian Throne | Cinder King | Blink-slash combos, meteor rain in phase 2 |

Story screens play between stages (Enter to advance). If you fall, Enter continues the current stage.
