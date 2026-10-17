'use strict';
// Builds the static demo site into _site/ (what GitHub Pages serves): the files in site/ as they are,
// plus cli-sources.js, the committed CLI JS from skills/bubble/scripts packed verbatim for bubble-web.js.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'skills', 'bubble', 'scripts');
const OUT = path.join(ROOT, process.argv[2] || '_site');

/** bubble.js and lib/**, keyed by forward-slash path relative to skills/bubble/scripts. */
function cliSources() {
  const files = ['bubble.js', ...fs.readdirSync(path.join(CLI, 'lib'), { recursive: true }).map((f) => path.join('lib', f))];
  const sources = {};
  for (const f of files.filter((f) => f.endsWith('.js')).sort()) sources[f.split(path.sep).join('/')] = fs.readFileSync(path.join(CLI, f), 'utf8');
  return sources;
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(__dirname)) if (f !== 'build.js') fs.cpSync(path.join(__dirname, f), path.join(OUT, f), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'cli-sources.js'), `self.BUBBLE_SOURCES = ${JSON.stringify(cliSources(), null, 1)};\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`built ${path.relative(ROOT, OUT)}/`);
}

if (require.main === module) build();
module.exports = { cliSources };
