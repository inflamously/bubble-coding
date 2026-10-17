// Assembles dist/pages/ (what GitHub Pages serves) after tsc has compiled src/site/ into dist/site/:
//   index.html, style.css      from src/site/terminal/
//   terminal/*.mjs             the page's compiled modules
//   bubble-web/*.mjs           the CLI-in-a-browser modules the page imports
//   cli-sources.json           the committed CLI JS from skills/bubble/scripts, verbatim
//   story.json                 demo/story.md as scenes
import fs from 'node:fs';
import path from 'node:path';
import { cliSources } from './sources.mjs';
import { parseStory } from './story.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..'); // this runs as dist/site/build/build.mjs
const COMPILED = path.join(ROOT, 'dist', 'site');
const OUT = path.join(ROOT, process.argv[2] ?? path.join('dist', 'pages'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(ROOT, 'src', 'site', 'terminal', f), path.join(OUT, f));
for (const dir of ['terminal', 'bubble-web']) fs.cpSync(path.join(COMPILED, dir), path.join(OUT, dir), { recursive: true });

const story = parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'story.json'), JSON.stringify(story));
fs.writeFileSync(path.join(OUT, 'cli-sources.json'), JSON.stringify(cliSources(path.join(ROOT, 'skills', 'bubble', 'scripts'))));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`built ${path.relative(ROOT, OUT)}/`);
