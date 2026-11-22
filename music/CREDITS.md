# Music credits

All four tracks are **CC0 (public domain)** from [OpenGameArt.org](https://opengameart.org). No attribution is required; they are credited here anyway.
They are cut, loudness-matched and re-encoded to MP3 for the game (bar-aligned loop for the boss track).

| File | Used for | Title | Author |
|---|---|---|---|
| `tower-inn.mp3` | title screen and menus (seamless loop) | Medieval: The Old Tower Inn (loop version) | RandomMind |
| `battle-a.mp3` | stages (alternates with the next one) | Battle Theme A | see its OpenGameArt page |
| `battlegrounds.mp3` | stages | Fantasy - Battlegrounds (remastered) | Doge |
| `boss.mp3` | boss fights (looped) | Battle Theme B | see its OpenGameArt page |

The story scenes, the shop, the forge and the victory screen still use the game's own procedural score (see `src/31-music.js`), which is also the fallback when a track cannot be loaded.
