// VELA BAY — an original open-world crime game for the make.fun gta6-01 bounty.
// Entry program (Node 22+, standard library only): copies the static game/ and the
// screenshots/ from beside this file into $MAKEFUN_OUTPUT_DIR (default /output),
// then writes dossier.json with the kit's vendored buildDossier, byte for byte the
// summary the judge reads. The game itself is plain static files: game/index.html
// opens in desktop Chrome and plays fully offline (three.js is vendored minified).
//
// Play locally:  node serve.ts   ->  http://localhost:8080
// Hand in:       MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the whole game tree and the screenshots into the output directory.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: 4 screenshots at 256 KiB each, 993 game entries at 48 MiB,
// index.html under 1 MiB, and 160 KiB of source text in the dossier.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`VELA BAY handed in: ${out}`);
// build marker