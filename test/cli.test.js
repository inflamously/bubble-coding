'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'skills', 'bubble', 'scripts', 'bubble.js');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-cli-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const track = () => JSON.parse(fs.readFileSync(path.join(dir, '.bubbles', 'track.json'), 'utf8'));
  run('init', 'P');
  for (const t of ['A', 'B', 'C']) run('add', t);
  return { run, track };
}
const titles = (t) => t.bubbles.map((b) => b.title).join('');

test('grammar: optional "bubble" word, one quoted phrase, insert at N ?', () => {
  const { run, track } = repo();
  assert.strictEqual(run('bubble', 'move', '1', 'to', '3').status, 0);
  assert.strictEqual(titles(track()), 'BCA');
  assert.strictEqual(run('move 2:3 to 1').status, 0);
  assert.strictEqual(titles(track()), 'CAB');
  run('insert', 'at', '2', '?');
  assert.deepStrictEqual(track().bubbles[1], { title: '???', state: 'fog' });
  run('add', '?');
  assert.strictEqual(track().bubbles[4].state, 'fog');
  run('insert', '1', 'Zero', 'first');
  assert.strictEqual(track().bubbles[0].title, 'Zero first');
  assert.strictEqual(run('title', 'Short', 'name').status, 0);
  assert.strictEqual(track().title, 'Short name');
  assert.match(run('title').stderr, /needs text/);
});

test('done prints the stop line; show still exits 3 on fog', () => {
  const { run } = repo();
  const r = run('done');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /⏸ stop/);
  run('fog', '2');
  assert.strictEqual(run('show').status, 3);
});

test('errors: usage, unknown options, --force for done bubbles', () => {
  const { run, track } = repo();
  assert.match(run('move', '1').stderr, /usage: move/);
  assert.match(run('hint', 'x').stderr, /usage: hint/);
  assert.match(run('add', 'x', '--into', '2').stderr, /unknown option/);
  run('done');
  assert.match(run('fog', '1').stderr, /--force/);
  assert.strictEqual(run('fog', '1', '--force').status, 0);
  assert.strictEqual(track().bubbles[0].state, 'fog');
});

test('multiple tracks: switch creates then resumes, tracks lists, delete guards', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-multi-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, '.bubbles', `${name}.json`), 'utf8'));
  const current = () => fs.readFileSync(path.join(dir, '.bubbles', 'current'), 'utf8').trim();

  assert.match(run('show').stderr, /switch <name>/);
  assert.match(run('switch').stderr, /no tracks yet/);
  assert.match(run('switch', 'idea-a', 'Idea', 'A').stdout, /created track "idea-a"/);
  run('add', 'first');
  assert.match(run('switch', 'idea-b').stdout, /created track "idea-b"/);
  run('add', 'other');
  assert.strictEqual(current(), 'idea-b');
  assert.deepStrictEqual(read('idea-a'), { title: 'Idea A', bubbles: [{ title: 'first', state: 'todo' }] });

  assert.match(run('switch').stdout, /resumed track "idea-b"/); // bare switch: the current track
  fs.writeFileSync(path.join(dir, '.bubbles', 'current'), 'gone\n');
  assert.match(run('switch', '--dir', dir).stderr, /no tracks yet/); // no current, no default
  run('switch', 'idea-b');

  const resumed = run('switch idea-a');
  assert.match(resumed.stdout, /resumed track "idea-a"/);
  assert.match(resumed.stdout, /◐ first/);
  assert.strictEqual(current(), 'idea-a');
  assert.match(run('tracks').stdout, /→ idea-a .*Idea A[\s\S]*  idea-b /);

  assert.match(run('create', 'idea-a').stderr, /already exists/);
  assert.match(run('switch', '../evil').stderr, /bad track name/);
  assert.match(run('delete', 'idea-a', '--force').stderr, /current track/);
  assert.match(run('delete', 'idea-b').stderr, /--force/);
  assert.strictEqual(run('delete', 'idea-b', '--force').status, 0);
  assert.ok(!fs.existsSync(path.join(dir, '.bubbles', 'idea-b.json')));

  fs.writeFileSync(path.join(dir, '.bubbles', 'current'), 'gone\n');
  assert.match(run('show').stderr, /current track "gone" not found .*idea-a/);
});

test('legacy track.json is the track named "track"', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-legacy-'));
  fs.mkdirSync(path.join(dir, '.bubbles'));
  fs.writeFileSync(path.join(dir, '.bubbles', 'track.json'), JSON.stringify({ title: 'Old', bubbles: [{ title: 'x', state: 'todo' }] }));
  const run = (...args) => spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8' });
  assert.match(run('show').stdout, /Old/);
  assert.match(run('tracks').stdout, /→ track /);
  run('switch', 'new-idea');
  assert.match(run('switch', 'track').stdout, /resumed track "track"/);
});

test('handoff note survives switching away and is shown on resume', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-handoff-'));
  const run = (...args) => spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8' });
  run('switch', 'idea');
  run('add', 'a');
  assert.match(run('handoff', 'parser', 'done').stdout, /fresh chat run: \/bubble switch idea/);
  run('switch', 'other');
  assert.match(run('switch', 'idea').stdout, /✎ handoff \(.* UTC\): parser done/);
  run('handoff', '-');
  assert.doesNotMatch(run('show').stdout, /handoff/);
});

test('fork: child track links to the parent bubble by relative path and becomes current', () => {
  const { run, track } = repo();
  const res = run('fork', '2', 'b-sub');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /forked "B" into track "b-sub"/);
  assert.match(res.stdout, /fork of #1 "B" in track\.json/);
  assert.strictEqual(track().bubbles[1].fork, 'b-sub.json');
  assert.strictEqual(track().bubbles[1].id, 1);
  assert.strictEqual(track().bubbles[1].state, 'todo');
  assert.match(run('show').stdout, /^B {3}S F/); // current is now the child, titled after the parent bubble
  assert.match(run('switch', 'track').stdout, /B ⑂ b-sub\.json/);
  assert.match(run('fork', '2', 'again').stderr, /already forked/);
  assert.match(run('fork', '3', 'b-sub').stderr, /already exists/);
  // ids survive reordering and are never reused
  run('move', '2', 'to', '1');
  run('fork', '3', 'c-sub');
  assert.deepStrictEqual(track().bubbles.map((b) => b.id), [1, undefined, 2]);
  run('switch', 'track');
  run('remove', '3');
  run('fork', '2', 'a-sub');
  assert.strictEqual(track().bubbles[1].id, 3);
});

test('diverge: side track links back by origin; the bubble keeps any state and can have several', () => {
  const { run, track } = repo();
  run('done');
  const res = run('diverge', '1', 'side-a');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /diverged from "A" into track "side-a"/);
  assert.match(res.stdout, /↗ diverged from #1 "A" in track\.json/);
  run('switch', 'track');
  run('diverge', '1', 'side-b');
  run('switch', 'track');
  assert.deepStrictEqual(track().bubbles[0], { title: 'A', state: 'done', id: 1, sides: ['side-a.json', 'side-b.json'] });
  assert.match(run('show').stdout, /A ↗ side-a\.json ↗ side-b\.json/);
});

test('fork links: the parent bubble waits for its fork; titles and completion flow back', () => {
  const { run, track } = repo();
  run('fork', '1', 'a-sub');
  // an empty child isn't finished: the parent bubble can't pop yet
  run('switch', 'track');
  assert.match(run('done').stderr, /waits for its fork a-sub\.json/);
  run('switch', 'a-sub');
  run('title', 'A deeper');
  assert.strictEqual(track().bubbles[0].title, 'A deeper');
  run('add', 'Step 1');
  run('add', 'Step 2');
  run('done');
  assert.strictEqual(track().bubbles[0].state, 'todo');
  const res = run('done');
  assert.match(res.stdout, /fork finished — popped "A deeper" in track\.json/);
  assert.strictEqual(track().bubbles[0].state, 'done');
  // parent rename flows into the fork
  run('switch', 'track');
  assert.strictEqual(run('fork', '2', 'b-sub').status, 0);
  run('switch', 'track');
  run('rename', '2', 'B wider');
  run('switch', 'b-sub');
  assert.match(run('show').stdout, /^B wider {3}S F/m);
  assert.match(run('show').stdout, /fork of #2 "B wider"/);
});
