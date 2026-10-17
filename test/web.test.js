'use strict';
// The demo site runs the committed CLI in a browser (site/bubble-web.js). It must print exactly what
// the real CLI prints, so every `bubble …` line of demo/story.md runs on both and the output is compared.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createMachine, words } = require('../site/bubble-web');
const { cliSources, parseStory } = require('../site/build');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'skills', 'bubble', 'scripts', 'bubble.js');

/** The `bubble …` lines of the story, as argv arrays. */
function storyCommands() {
  return parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'))
    .flatMap((scene) => scene.steps)
    .filter((step) => step.kind === 'run' && step.line.startsWith('bubble '))
    .map((step) => words(step.line).slice(1));
}

test('the browser CLI prints what the real CLI prints, for every line of the demo story', () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-web-')));
  const web = createMachine(cliSources());
  // Paths and the handoff minute differ between the two machines; everything else must match.
  const norm = (s) => s.split(dir).join(web.cwd()).replace(/\\/g, '/').replace(/\d{4}-\d\d-\d\d \d\d:\d\d UTC/g, '<at> UTC');
  const commands = storyCommands();
  assert.ok(commands.length > 20, 'demo/story.md has no bubble commands');
  for (const argv of commands) {
    const real = spawnSync(process.execPath, [CLI, ...argv], { cwd: dir, encoding: 'utf8', env: { ...process.env, BUBBLES_COLOR: '0', BUBBLES_ASCII: '', NO_COLOR: '' } });
    const got = web.bubble(argv, { color: false });
    const text = (stream) => got.out.filter((o) => o.stream === stream).map((o) => o.text).join('');
    const line = `bubble ${argv.join(' ')}`;
    assert.strictEqual(norm(text('stdout')), norm(real.stdout), line);
    assert.strictEqual(norm(text('stderr')), norm(real.stderr), line);
    assert.strictEqual(got.code, real.status, line);
  }
  // And the disk ends up the same: every track file, byte for byte (but the handoff minute).
  const realDir = path.join(dir, '.bubbles');
  const webDir = web.path.join(web.cwd(), '.bubbles');
  assert.deepStrictEqual(web.fs.readdirSync(webDir), fs.readdirSync(realDir).sort());
  for (const f of fs.readdirSync(realDir)) {
    assert.strictEqual(norm(web.fs.readFileSync(web.path.join(webDir, f))), norm(fs.readFileSync(path.join(realDir, f), 'utf8')), f);
  }
});

test('parseStory: scenes with captions, commands and notes', () => {
  const scenes = parseStory('# Demo\n\nintro\n\n## 1. Sketch\n\n> human: plan `it`\n\n```\nbubble add A\nls\n```\n\nA note\nthat wraps.\n');
  assert.deepStrictEqual(scenes, [
    {
      title: 'Sketch',
      notes: ['A note that wraps.'],
      steps: [
        { kind: 'say', who: 'human', text: 'plan it' },
        { kind: 'run', line: 'bubble add A' },
        { kind: 'run', line: 'ls' },
      ],
    },
  ]);
});

test('words: split a command line like a shell', () => {
  assert.deepStrictEqual(words(`bubble diverge 3 web-ui "Web UI"`), ['bubble', 'diverge', '3', 'web-ui', 'Web UI']);
  assert.deepStrictEqual(words(`  add  'it''s'  ""  `), ['add', 'its', '']);
  assert.throws(() => words('add "open'), /unterminated quote/);
});
