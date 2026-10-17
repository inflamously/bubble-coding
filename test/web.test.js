'use strict';
// The demo site (src/site/) is TypeScript. This compiles it like `npm run site` does, then checks that
// bubble-web, the CLI in a browser, prints exactly what the real CLI prints: every `bubble …` line
// of demo/story.md runs on both and the output and the disk are compared.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CLI_DIR = path.join(ROOT, 'skills', 'bubble', 'scripts');

/** Compile src/site/<part> into `out` (the tsc type check is part of the test) and import a module of it. */
function compileSite(out) {
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  for (const part of ['bubble-web', 'terminal', 'build']) {
    const r = spawnSync(process.execPath, [tsc, '-p', path.join(ROOT, 'src', 'site', part), '--outDir', out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `tsc -p src/site/${part} failed:\n${r.stdout}${r.stderr}`);
  }
  return (file) => import(pathToFileURL(path.join(out, file)).href);
}

const load = compileSite(fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-site-')));

test('the browser CLI prints what the real CLI prints, for every line of the demo story', async () => {
  const { createMachine, words } = await load('bubble-web/index.mjs');
  const { parseStory } = await load('build/story.mjs');
  const { cliSources } = await load('build/sources.mjs');

  const commands = parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'))
    .flatMap((scene) => scene.steps)
    .filter((step) => step.kind === 'run' && step.line.startsWith('bubble '))
    .map((step) => words(step.line).slice(1));
  assert.ok(commands.length > 20, 'demo/story.md has no bubble commands');

  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-web-')));
  const web = createMachine(cliSources(CLI_DIR), { cwd: '/home/demo/todo-app' });
  // Paths and the handoff minute differ between the two machines; everything else must match.
  const norm = (s) => s.split(dir).join(web.cwd()).replace(/\\/g, '/').replace(/\d{4}-\d\d-\d\d \d\d:\d\d UTC/g, '<at> UTC');
  for (const argv of commands) {
    const real = spawnSync(process.execPath, [path.join(CLI_DIR, 'bubble.js'), ...argv], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, BUBBLES_COLOR: '0', BUBBLES_ASCII: '', NO_COLOR: '' },
    });
    const got = web.bubble(argv, { color: false });
    const text = (stream) => got.out.filter((o) => o.stream === stream).map((o) => o.text).join('');
    const line = `bubble ${argv.join(' ')}`;
    assert.strictEqual(norm(text('stdout')), norm(real.stdout), line);
    assert.strictEqual(norm(text('stderr')), norm(real.stderr), line);
    assert.strictEqual(got.code, real.status, line);
  }
  // And the disk ends up the same: every track file, byte for byte (but the handoff minute).
  const realDir = path.join(dir, '.bubble-tracks');
  const webDir = web.path.join(web.cwd(), '.bubble-tracks');
  assert.deepStrictEqual(web.fs.readdirSync(webDir), fs.readdirSync(realDir).sort());
  for (const f of fs.readdirSync(realDir)) {
    assert.strictEqual(norm(web.fs.readFileSync(web.path.join(webDir, f))), norm(fs.readFileSync(path.join(realDir, f), 'utf8')), f);
  }
});

test('parseStory: scenes with captions, commands and notes', async () => {
  const { parseStory } = await load('build/story.mjs');
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

test('words: split a command line like a shell', async () => {
  const { words } = await load('bubble-web/index.mjs');
  assert.deepStrictEqual(words(`bubble diverge 3 web-ui "Web UI"`), ['bubble', 'diverge', '3', 'web-ui', 'Web UI']);
  assert.deepStrictEqual(words(`  add  'it''s'  ""  `), ['add', 'its', '']);
  assert.throws(() => words('add "open'), /unterminated quote/);
});

test('posix path: the calls the CLI makes', async () => {
  const { createMachine } = await load('bubble-web/index.mjs');
  const { path: p } = createMachine({}, { cwd: '/home/demo/x' });
  assert.strictEqual(p.resolve('q'), '/home/demo/x/q');
  assert.strictEqual(p.resolve('x', '/y', 'z'), '/y/z');
  assert.strictEqual(p.relative('/a/b/c', '/a/d'), '../../d');
  assert.strictEqual(p.relative('/a/.bubble-tracks/x.json', '/a/.bubble-tracks/y.json'), '../y.json');
  assert.strictEqual(p.dirname('/a/b.json'), '/a');
  assert.strictEqual(p.basename('/a/b.json', '.json'), 'b');
  assert.strictEqual(p.join('/a', '..', 'b', './c'), '/b/c');
});
