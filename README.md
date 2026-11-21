# VELA BAY — an open-world crime story

[![make.fun bounty gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank on make.fun](https://make.fun/badge/gta6-01/Fliztone/makefun-gta6-01-fg1/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward on make.fun](https://make.fun/badge/gta6-01/Fliztone/makefun-gta6-01-fg1/reward.svg)](https://make.fun/bounty/gta6-01)

An original, sun-soaked open-world crime game built for the [make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
Everything — city, characters, vehicles, story, art and sound — is original. No assets from any commercial game.

**Vela Bay** is a neon-and-palm coastal city you explore on foot and behind the wheel: steal any car,
run from the Vela Bay PD, shoot your way out of trouble, and work five story jobs for fixer Dahlia Cruz —
from a simple delivery to a sunset street race and the last drop.

## Play

The game is plain static files with **no build step and no network requests**. Serve `game/` with any
static server and open it in desktop Chrome:

```
node serve.ts          # -> http://localhost:8080
```

or hand the entry in (Node 22+, stdlib only):

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | move · drive |
| Mouse | look · aim |
| Left click | shoot (on foot) |
| Right click (hold) | aim |
| E / F | enter · exit · carjack any vehicle |
| Space | handbrake (in car) · jump (on foot) |
| Shift | sprint |
| R | reload |
| Esc | pause / save / load |

## Features

- Procedural coastal city: street grid, pastel towers, neon signage, palms, beach and animated sunset water
- Third-person on-foot controller and arcade driving with any of 6 vehicle types
- Living streets: AI traffic and sidewalk pedestrians
- Carjacking, 5-star wanted level, pursuing police with sirens and lightbars, evasion cooldown
- Pistol combat: aiming, tracers, muzzle flash, impact particles, reloads
- 5 story missions with objectives, markers, cash rewards and progression; free roam after the story
- HUD: minimap, wanted stars, cash, health, speedometer, ammo, mission text, dialogs
- Start screen, pause menu, save/load via localStorage
- Fully procedural WebAudio: engine, sirens, gunshots, pickups, skids, ambient sunset pad
- Skid marks, particle effects, soft shadows, fog, sunset lighting

## Tech

three.js (vendored minified under `game/vendor/`), own ES modules under `game/js/`, one canvas HUD layer,
one WebGL scene. Source is split by job: `world`, `city`, `vehicles`, `traffic`, `pedestrians`, `player`,
`police`, `wanted`, `weapons`, `missions`, `hud`, `minimap`, `audio`, `effects`, `camera`, `input`, `save`.

## License

MIT — see [LICENSE](LICENSE).