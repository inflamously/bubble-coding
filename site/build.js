'use strict';
// Builds the static demo site into _site/ (what GitHub Pages serves): the files in site/ as they are,
// plus cli-sources.js, the committed CLI JS from skills/bubble/scripts packed verbatim for bubble-web.js,
// and story.js, demo/story.md as scenes for the player.
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

/**
 * demo/story.md as scenes: `## N. Title` starts one; `> who: text` is a caption; each line in a
 * code block is a command; any other paragraph is a note shown with the scene.
 */
function parseStory(md) {
  const scenes = [];
  let inCode = false;
  let para = [];
  const flush = () => {
    if (para.length && scenes.length) scenes[scenes.length - 1].notes.push(para.join(' ').replace(/`/g, ''));
    para = [];
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('```')) {
      flush();
      inCode = !inCode;
      continue;
    }
    const scene = scenes[scenes.length - 1];
    if (inCode) {
      if (line.trim() && scene) scene.steps.push({ kind: 'run', line: line.trim() });
      continue;
    }
    const heading = /^## (?:\d+\.\s*)?(.+)$/.exec(line);
    const say = /^> (\w+): (.+)$/.exec(line);
    if (heading) {
      flush();
      scenes.push({ title: heading[1], notes: [], steps: [] });
    } else if (say) {
      flush();
      if (scene) scene.steps.push({ kind: 'say', who: say[1], text: say[2].replace(/`/g, '') });
    } else if (!line.trim() || line.startsWith('#')) flush();
    else para.push(line.trim());
  }
  flush();
  return scenes;
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(__dirname)) if (f !== 'build.js') fs.cpSync(path.join(__dirname, f), path.join(OUT, f), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'cli-sources.js'), `self.BUBBLE_SOURCES = ${JSON.stringify(cliSources(), null, 1)};\n`);
  const story = parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'story.js'), `self.BUBBLE_STORY = ${JSON.stringify(story, null, 1)};\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`built ${path.relative(ROOT, OUT)}/`);
}

if (require.main === module) build();
module.exports = { cliSources, parseStory };
