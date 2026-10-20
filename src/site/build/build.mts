// Assembles dist/pages/ (what GitHub Pages serves) after tsc has compiled src/site/ into dist/site/:
//   index.html, style.css      from src/site/terminal/
//   terminal/*.mjs             the page's compiled modules
//   bubble-web/*.mjs           the CLI-in-a-browser modules the page imports
//   cli-sources.json           the committed CLI JS from skills/bubble/scripts, verbatim
//   story.json                 demo/story.md as scenes
// Every URL the page loads carries ?v=<hash of the build>, so a browser never mixes in stale cached files:
// index.html links style.css and main.mjs with it, an import map adds it to the other modules, and main.mjs
// passes its own ?v= on to the JSON it fetches.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliSources } from './sources.mjs';
import { parseStory } from './story.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'); // this runs as dist/site/build/build.mjs
const COMPILED = path.join(ROOT, 'dist', 'site');
const OUT = path.join(ROOT, process.argv[2] ?? path.join('dist', 'pages'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'style.css'), fs.readFileSync(path.join(ROOT, 'src', 'site', 'terminal', 'style.css')));
for (const dir of ['terminal', 'bubble-web']) fs.cpSync(path.join(COMPILED, dir), path.join(OUT, dir), { recursive: true });

const story = parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'story.json'), JSON.stringify(story));
fs.writeFileSync(path.join(OUT, 'cli-sources.json'), JSON.stringify(cliSources(path.join(ROOT, 'skills', 'bubble', 'scripts'))));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const files = fs.readdirSync(OUT, { recursive: true }).map((f) => String(f).split(path.sep).join('/')).filter((f) => fs.statSync(path.join(OUT, f)).isFile()).sort();
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(`${f}\0`).update(fs.readFileSync(path.join(OUT, f)));
const v = `?v=${hash.update(fs.readFileSync(path.join(ROOT, 'src', 'site', 'terminal', 'index.html'))).digest('hex').slice(0, 10)}`;
const imports = Object.fromEntries(files.filter((f) => f.endsWith('.mjs')).map((f) => [`./${f}`, `./${f}${v}`]));
const html = fs
  .readFileSync(path.join(ROOT, 'src', 'site', 'terminal', 'index.html'), 'utf8')
  .replace('href="style.css"', `href="style.css${v}"`)
  .replace('<script type="module" src="terminal/main.mjs"></script>', `<script type="importmap">${JSON.stringify({ imports })}</script>\n<script type="module" src="terminal/main.mjs${v}"></script>`);
if (!html.includes(v + '"></script>') || !html.includes(`style.css${v}`)) throw new Error('index.html: style.css or the main.mjs script tag moved; update build.mts');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`built ${path.relative(ROOT, OUT)}/`);
