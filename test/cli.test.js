import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'skills', 'bubble', 'scripts', 'cli', 'bubble.js');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-cli-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const track = () => JSON.parse(fs.readFileSync(path.join(dir, '.bubble-tracks', 'track.json'), 'utf8'));
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
  assert.deepStrictEqual(track().bubbles[1], { title: '???', state: 'fog', id: 4 }); // A B C are 1 2 3
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
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8'));
  const current = () => fs.readFileSync(path.join(dir, '.bubble-tracks', 'current'), 'utf8').trim();

  assert.match(run('show').stderr, /switch <name>/);
  assert.match(run('switch').stderr, /no tracks yet/);
  assert.match(run('switch', 'idea-a', 'Idea', 'A').stdout, /created track "idea-a"/);
  run('add', 'first');
  assert.match(run('switch', 'idea-b').stdout, /created track "idea-b"/);
  run('add', 'other');
  assert.strictEqual(current(), 'idea-b');
  assert.deepStrictEqual(read('idea-a'), { title: 'Idea A', bubbles: [{ title: 'first', state: 'todo', id: 1 }], nextId: 2 });

  assert.match(run('switch').stdout, /resumed track "idea-b"/); // bare switch: the current track
  fs.writeFileSync(path.join(dir, '.bubble-tracks', 'current'), 'gone\n');
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
  assert.ok(!fs.existsSync(path.join(dir, '.bubble-tracks', 'idea-b.json')));

  fs.writeFileSync(path.join(dir, '.bubble-tracks', 'current'), 'gone\n');
  assert.match(run('show').stderr, /current track "gone" not found .*idea-a/);
});

test('close: needs --force, marks the track closed, stays current, only once', () => {
  const { run, track } = repo();
  run('done');
  assert.match(run('close', 'nope', '--force').stderr, /no track "nope"/);
  assert.match(run('close', 'track').stderr, /permanent .*--force/);
  assert.strictEqual(track().closed, undefined);
  const r = run('close', 'track', '--force');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /closed track "track" — read-only/);
  const t = track();
  assert.ok(!Number.isNaN(Date.parse(t.closed.at)));
  assert.deepStrictEqual(t.bubbles.map((b) => b.state), ['done', 'todo', 'todo']); // open bubbles keep their state
  assert.match(run('tracks').stdout, /→ track .*S ●──○──○ F   🔒 closed/); // still current, nothing active
  assert.match(run('close', 'track', '--force').stderr, /already closed/);
});

test('tracks hides closed tracks unless current; --closed lists only them, --all everything', () => {
  const { run } = repo();
  for (const t of ['old', 'open', 'done']) run('switch', t);
  run('add', 'D');
  run('done'); // "done" is all done but not closed: it still shows
  run('close', 'old', '--force');
  run('close', 'track', '--force');
  run('switch', 'track'); // current and closed: it still shows
  const names = (out) => out.split('\n').filter((l) => /^[→ ] [a-z]/.test(l)).map((l) => l.slice(2).split(' ')[0]);
  let out = run('tracks').stdout;
  assert.deepStrictEqual(names(out), ['done', 'open', 'track']);
  assert.match(out, /  1 closed hidden — tracks --all/);
  out = run('tracks', '--closed').stdout;
  assert.deepStrictEqual(names(out), ['old', 'track']);
  assert.doesNotMatch(out, /hidden/);
  out = run('tracks', '--all').stdout;
  assert.deepStrictEqual(names(out), ['done', 'old', 'open', 'track']);
  assert.doesNotMatch(out, /hidden/);
  assert.match(run('tracks', '--closed', '--all').stderr, /--closed or --all, not both/);
  run('switch', 'open');
  assert.deepStrictEqual(names(run('tracks').stdout), ['done', 'open']); // no longer current: hidden too
  assert.match(run('tracks').stdout, /2 closed hidden/);
});

test('tracks --closed with nothing closed says so', () => {
  const { run } = repo();
  assert.match(run('tracks', '--closed').stdout, /^no closed tracks$/m);
});

test('closed track is read-only: every change is refused, nothing is written', () => {
  const { run, track } = repo();
  run('hint', '2', 'note');
  run('fog', '3');
  run('close', 'track', '--force');
  const before = JSON.stringify(track());
  const changes = [
    ['add', 'D'], ['add', '?'], ['insert', 'at', '1', 'Z'], ['remove', '1'], ['move', '1', 'to', '3'],
    ['rename', '1', 'X'], ['title', 'New'], ['hint', '1', 'h'], ['hint', '2', '-'], ['fog', '2'],
    ['type', '3', 'kk'], ['fill', '3', 'F'], ['done'], ['handoff', 'note'],
  ];
  for (const args of changes) {
    const r = run(...args);
    assert.strictEqual(r.status, 1, args.join(' '));
    assert.match(r.stderr, /track "track" is closed \(read-only\) — fork, diverge or switch/, args.join(' '));
  }
  assert.strictEqual(JSON.stringify(track()), before);
  assert.strictEqual(run('show').status, 0);
  assert.match(run('move', '1').stderr, /usage: move/); // bad input still gets its usage line
});

test('show on a closed track: every title and hint, nothing active, fog never exits 3', () => {
  const { run } = repo();
  run('hint', '2', 'the detail');
  run('fog', '1');
  assert.strictEqual(run('show').status, 3);
  run('close', 'track', '--force');
  const r = run('show');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /  1   ❓ fog    A\n  2   ○ todo   B\n        ↳ the detail\n  3   ○ todo   C/);
  assert.doesNotMatch(r.stdout, /→|needs the human|is fog/);
  assert.match(r.stdout, /🔒 closed \d{4}-\d\d-\d\dT.* — read-only/);
});

test('fork and diverge from a closed track: the child links back, the closed track is never written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-closed-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const raw = (name) => fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8');
  const current = () => fs.readFileSync(path.join(dir, '.bubble-tracks', 'current'), 'utf8').trim();
  run('switch', 'old');
  for (const t of ['A', 'B', 'C']) run('add', t);
  run('done');
  run('close', 'old', '--force');
  const before = raw('old');

  const side = run('diverge', '2', 'side');
  assert.strictEqual(side.status, 0);
  assert.match(side.stdout, /diverged from "B" of closed track "old" into track "side"/);
  assert.deepStrictEqual(JSON.parse(raw('side')).origin, { track: 'old.json', bubble: 2, title: 'B' });
  assert.strictEqual(current(), 'side');

  run('switch', 'old');
  assert.match(run('fork', '3', 'deeper').stdout, /forked "C" of closed track "old"/);
  assert.strictEqual(JSON.parse(raw('deeper')).parent.title, 'C');
  assert.strictEqual(current(), 'deeper');
  assert.strictEqual(raw('old'), before);
});

test('links skip closed tracks: no title sync either way, no pop into a closed parent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-links-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const raw = (name) => fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8');

  // closed parent: a child forked off it runs on, nothing flows back
  run('switch', 'top');
  run('add', 'A');
  run('add', 'B');
  run('close', 'top', '--force');
  run('fork', '1', 'kid');
  run('add', 'only');
  const top = raw('top');
  assert.strictEqual(run('title', 'Renamed').status, 0);
  assert.strictEqual(JSON.parse(raw('kid')).parent.title, 'A'); // still names the bubble it came from
  const done = run('done');
  assert.strictEqual(done.status, 0);
  assert.doesNotMatch(done.stdout, /popped "A"/);
  assert.strictEqual(raw('top'), top);

  // closed child: renaming the open parent's bubble leaves it alone
  run('switch', 'p2');
  run('add', 'X');
  run('fork', '1', 'k2');
  run('add', 'y');
  run('close', 'k2', '--force');
  const k2 = raw('k2');
  run('switch', 'p2');
  const r = run('rename', '1', 'Z');
  assert.strictEqual(r.status, 0);
  assert.doesNotMatch(r.stdout, /renamed too/);
  assert.strictEqual(raw('k2'), k2);
});

test('closing a fork counts as finished: the parent bubble pops, on up the chain; done stops waiting', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-closepop-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const load = (name) => JSON.parse(fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8'));

  // a closed fork pops its parent bubble, and the now finished parent pops its own parent
  run('switch', 'top');
  run('add', 'A');
  run('add', 'B');
  run('fork', '1', 'mid');
  run('add', 'm');
  run('fork', '1', 'leaf');
  run('add', 'unfinished');
  const r = run('close', 'leaf', '--force');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /fork finished — popped "m" in mid\.json/);
  assert.match(r.stdout, /fork finished — popped "A" in top\.json/);
  assert.strictEqual(load('leaf').bubbles[0].state, 'todo'); // open bubbles keep their state
  assert.deepStrictEqual(load('top').bubbles.map((b) => b.state), ['done', 'todo']);

  // done on the parent no longer waits for a closed fork
  run('switch', 'p3');
  run('add', 'Y');
  run('fork', '1', 'k3');
  run('switch', 'p3');
  assert.match(run('done').stderr, /waits for its fork k3\.json/); // empty, open fork: still waits
  fs.writeFileSync(path.join(dir, '.bubble-tracks', 'k3.json'), JSON.stringify({ ...load('k3'), closed: { at: '2026-10-17T00:00:00.000Z' } }));
  assert.match(run('done').stdout, /popped "Y"/);
});

test('close cascades top down to every fork, whatever its state; side tracks stay open; only the top pops', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-cascade-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const load = (name) => JSON.parse(fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8'));

  // root #1 -> top; top #1 -> mid -> leaf, top #2 -> done-kid (finished), top #3 -> gone (deleted), top #3 -> side (diverged)
  run('switch', 'root');
  run('add', 'R');
  run('fork', '1', 'top');
  for (const t of ['A', 'B', 'C']) run('add', t);
  run('fork', '2', 'done-kid');
  run('add', 'd');
  run('done');
  run('switch', 'top');
  run('fork', '3', 'gone');
  run('switch', 'top');
  run('diverge', '3', 'side');
  run('add', 's');
  run('switch', 'top');
  run('fork', '1', 'mid');
  run('add', 'm');
  run('fork', '1', 'leaf');
  run('add', '?');
  run('switch', 'root');
  run('delete', 'gone', '--force');

  const ask = run('close', 'top');
  assert.match(ask.stderr, /closing "top" \(and its forks "mid", "leaf", "done-kid"\) is permanent .*--force/);
  assert.strictEqual(load('top').closed, undefined);

  const r = run('close', 'top', '--force');
  assert.strictEqual(r.status, 0, r.stderr);
  const lines = r.stdout.split('\n');
  const at = (re) => lines.findIndex((l) => re.test(l));
  assert.ok(at(/^closed track "top"/) < at(/closed fork "mid"/) && at(/closed fork "mid"/) < at(/closed fork "leaf"/)); // top down
  assert.match(r.stdout, /fork finished — popped "R" in root\.json/); // the top pops its own parent
  assert.match(r.stdout, /closed fork "done-kid"/);
  assert.match(r.stdout, /fork "gone": missing, skipped/);
  for (const t of ['top', 'mid', 'leaf', 'done-kid']) assert.ok(load(t).closed, t);
  assert.strictEqual(load('side').closed, undefined); // diverged: independent by design
  assert.deepStrictEqual(load('top').bubbles.map((b) => b.state), ['todo', 'done', 'todo']); // forks never pop the closing parent
  assert.strictEqual(load('leaf').bubbles[0].state, 'fog'); // any state

  // re-running close on a closed track picks up forks still open (e.g. after a failure), notes the rest
  const mid = load('mid');
  delete mid.closed;
  fs.writeFileSync(path.join(dir, '.bubble-tracks', 'mid.json'), JSON.stringify(mid));
  const again = run('close', 'top', '--force');
  assert.strictEqual(again.status, 0, again.stderr);
  assert.match(again.stdout, /track "top" is already closed — closing its open forks/);
  assert.match(again.stdout, /closed fork "mid"/);
  assert.match(again.stdout, /fork "leaf": already closed/);
  assert.match(run('close', 'top', '--force').stderr, /track "top" is already closed/);
});

/** A repo with track "main" (A B C, current) and track "other" (X). */
function twoTracks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-to-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, BUBBLES_ASCII: '' } });
  const file = (name) => path.join(dir, '.bubble-tracks', name);
  const read = (name) => JSON.parse(fs.readFileSync(file(`${name}.json`), 'utf8'));
  const current = () => fs.readFileSync(file('current'), 'utf8').trim();
  run('create', 'other', 'O');
  run('add', 'X');
  run('create', 'main', 'M');
  for (const t of ['A', 'B', 'C']) run('add', t);
  return { run, read, current };
}

test('--to: add, insert and hint write into that track; the current track stays as it is', () => {
  const { run, read, current } = twoTracks();
  const main = JSON.stringify(read('main'));
  const r = run('add', 'Later', '--to', 'other');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /added bubble "Later" — on track "other"; the current track stays "main"/);
  assert.match(r.stdout, /^O   S ◐──○ F/m); // shows the track it wrote into
  run('add', '?', '--to', 'other');
  run('insert', 'at', '1', 'First', '--to', 'other');
  run('hint', '2', 'x note', '--to', 'other');
  assert.deepStrictEqual(read('other').bubbles, [
    { title: 'First', state: 'todo', id: 4 },
    { title: 'X', state: 'todo', id: 1, hint: 'x note' },
    { title: 'Later', state: 'todo', id: 2 },
    { title: '???', state: 'fog', id: 3 },
  ]);
  assert.strictEqual(JSON.stringify(read('main')), main);
  assert.strictEqual(current(), 'main');
});

test('options: --to=<track> works, text starting with - goes after --, a missing value is named', () => {
  const { run, read } = twoTracks();
  assert.strictEqual(run('add', 'Eq', '--to=other').status, 0);
  assert.strictEqual(read('other').bubbles.at(-1).title, 'Eq');
  const r = run('hint', '2', 'use', '-v', 'flag');
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /unknown option "-v" — try: help \(text starting with - goes after --\)/);
  assert.strictEqual(read('main').bubbles[1].hint, undefined);
  assert.strictEqual(run('hint', '2', '--', 'use', '-v', 'flag').status, 0);
  assert.strictEqual(read('main').bubbles[1].hint, 'use -v flag');
  assert.strictEqual(run('hint', '2', '-').status, 0); // a lone - still clears
  assert.strictEqual(read('main').bubbles[1].hint, undefined);
  assert.match(run('show', '--at').stderr, /--at needs a value/);
});

test('--to refuses: missing or closed target, commands that do not take it; nothing is written', () => {
  const { run, read } = twoTracks();
  const before = () => JSON.stringify([read('main'), read('other')]);
  const saved = before();
  assert.match(run('add', 'Z', '--to', 'nope').stderr, /no track "nope" — create it first/);
  assert.match(run('add', 'Z', '--to', '../evil').stderr, /bad track name/);
  assert.match(run('add', 'Z', '--to').stderr, /--to needs a track name/);
  assert.match(run('add', 'Z', '--to', '--force').stderr, /--to needs a track name/);
  for (const args of [['done'], ['fog', '1'], ['remove', '1'], ['rename', '1', 'Y'], ['show']]) {
    assert.match(run(...args, '--to', 'other').stderr, /--to works only with add, insert, hint and move/, args.join(' '));
  }
  assert.strictEqual(before(), saved);
  run('switch', 'other');
  run('close', 'other', '--force');
  run('switch', 'main');
  const closed = before();
  assert.match(run('add', 'Z', '--to', 'other').stderr, /track "other" is closed \(read-only\)/);
  assert.match(run('move', '1', '--to', 'other').stderr, /track "other" is closed \(read-only\)/);
  assert.strictEqual(before(), closed);
});

test('move --to: bubbles go to the end of the other track with new ids; linked ones and bad input are refused', () => {
  const { run, read, current } = twoTracks();
  run('hint', '2', 'b note');
  run('done');
  const r = run('move', '1:2', '--to', 'other');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /moved "A", "B" to track "other"\n\nO   S ◐──●──○ F/);
  assert.match(r.stdout, /^M   S ◐ F   ◐ C$/m); // then the current track, now without them
  assert.deepStrictEqual(read('main').bubbles, [{ title: 'C', state: 'todo', id: 3 }]);
  assert.deepStrictEqual(read('other').bubbles, [
    { title: 'X', state: 'todo', id: 1 },
    { title: 'A', state: 'done', id: 2 },
    { title: 'B', state: 'todo', id: 3, hint: 'b note' },
  ]);
  assert.strictEqual(current(), 'main');

  const saved = JSON.stringify([read('main'), read('other')]);
  assert.match(run('move', '1', '--to', 'main').stderr, /"main" is the current track — use: move N to M/);
  assert.match(run('move', '1', 'to', '2', '--to', 'other').stderr, /usage: move .*--to <track>/);
  assert.match(run('move', '5', '--to', 'other').stderr, /no bubble at "5"/);
  run('diverge', '1', 'side');
  run('switch', 'main');
  const linked = JSON.stringify([read('main'), read('other')]);
  assert.match(run('move', '1', '--to', 'other').stderr, /"C" has a fork or side track linked to this track/);
  assert.strictEqual(JSON.stringify([read('main'), read('other')]), linked);
  assert.notStrictEqual(linked, saved); // the diverge itself did write main
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

test('goal and guards are stored on the track and shown on resume', () => {
  const { run, track } = repo();
  assert.match(run('goal', 'Parse', 'v2', 'files').stdout, /⚑ goal: Parse v2 files/);
  run('guard', "don't", 'touch', 'src/site');
  run('guard', 'no', 'new', 'deps');
  assert.deepStrictEqual(track().guards, ["don't touch src/site", 'no new deps']);
  assert.match(run('switch').stdout, /¦ guards \(before you act\):\n {4}1 {2}don't touch src\/site\n {4}2 {2}no new deps/);
  assert.doesNotMatch(run('show').stdout, /guards/); // only on switch, guard and guard show
  assert.doesNotMatch(run('add', 'D').stdout, /guards/);
  assert.match(run('guard', 'show').stdout, /^¦ guards \(before you act\):\n {4}1 {2}don't touch src\/site/);
  assert.match(run('guard', 'drop', '1').stdout, /dropped guard 1: don't touch src\/site/);
  assert.deepStrictEqual(track().guards, ['no new deps']);
  assert.match(run('guard', 'drop', '5').stderr, /no guard 5/);
  assert.match(run('guard', '-').stderr, /guards drop with: guard drop N/);
  assert.match(run('guard', 'drop', '--all').stderr, /re-run with --force/);
  assert.deepStrictEqual(track().guards, ['no new deps']);
  assert.match(run('guard', 'drop', '--all', '--force').stdout, /dropped 1 guard/);
  assert.match(run('guard', 'drop', '--all').stdout, /no guards to drop/);
  assert.strictEqual('guards' in track(), false);
  assert.doesNotMatch(run('show').stdout, /guards/);
  assert.match(run('goal', 'Ship', 'it').stderr, /already has a goal: "Parse v2 files" — a new goal is a new track: diverge <name>/);
  assert.match(run('goal', '-').stderr, /set once and can't be cleared/);
  assert.match(run('goal', 'Parse', 'v2', 'and', 'v3', '--force').stdout, /goal "Parse v2 files" → "Parse v2 and v3"/);
  assert.strictEqual(track().goal, 'Parse v2 and v3');
  assert.match(run('guard').stderr, /guard needs text/);
  assert.match(run('guard', 'show').stdout, /no guards/);
});

test('research prints the workflow and the bubble context; findings are noted on the bubble', () => {
  const { run, track } = repo();
  run('goal', 'Ship C');
  run('guard', 'no', 'new', 'deps');
  run('hint', '2', 'use the old parser');
  const r = run('research', '2', 'focus', 'on', 'speed');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^research #2 "B" — run this once; extend the human's intent, never overrule it\nthe human adds: focus on speed/);
  assert.match(r.stdout, /finding 2 <tip — source>/);
  assert.match(r.stdout, /insert at 3 <title>/);
  assert.match(r.stdout, /⚑ goal: Ship C\n¦ guards \(before you act\):\n {4}1 {2}no new deps\n#2 "B" \(todo\)\n↳ use the old parser/);
  assert.match(r.stdout, /before: #1 "A" \(todo\)\nafter: #3 "C" \(todo\)/);
  assert.match(r.stdout, /⏸ stop/);
  assert.match(run('research').stdout, /#1 "A" \(todo, active\)/); // no N: the active bubble
  assert.match(run('research', '9').stderr, /no bubble at "9"/);
  const before = JSON.stringify(track());
  run('research', '1');
  assert.strictEqual(JSON.stringify(track()), before); // research changes nothing itself

  assert.match(run('finding', '2', 'cache the AST — docs/parser.md').stdout, /finding 1 on "B": cache the AST — docs\/parser.md/);
  run('finding', '2', 'stream input — node:readline');
  assert.deepStrictEqual(track().bubbles[1].findings, ['cache the AST — docs/parser.md', 'stream input — node:readline']);
  assert.match(run('show').stdout, /↳ use the old parser\n {8}found 1: cache the AST — docs\/parser.md\n {8}found 2: stream input/);
  assert.match(run('research', '2').stdout, /found 1: cache the AST/); // findings feed the next research
  assert.match(run('finding', '2', '1', '-').stdout, /dropped finding 1 on "B": cache the AST/);
  assert.match(run('finding', '2', '5', '-').stderr, /no finding 5 on "B"/);
  assert.match(run('finding', '2', '-').stdout, /dropped 1 finding on "B"/);
  assert.strictEqual('findings' in track().bubbles[1], false);
  assert.match(run('finding', '2', '-').stdout, /no findings on "B" to drop/);
  assert.match(run('finding', '2').stderr, /finding needs text/);
  assert.match(run('finding', 'x').stderr, /usage: finding N/);

  run('fog', '3');
  assert.match(run('finding', '3', 'json is what the team reads').stdout, /finding 1 on "C"/); // fog takes findings too
  assert.match(run('research', '3').stdout, /#3 "C" \(fog\)/);
});

test('fork: child track links to the parent bubble by relative path and becomes current', () => {
  const { run, track } = repo();
  const res = run('fork', '2', 'b-sub');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /forked "B" into track "b-sub"/);
  assert.match(res.stdout, /fork of #2 "B" in track\.json/);
  assert.strictEqual(track().bubbles[1].fork, 'b-sub.json');
  assert.strictEqual(track().bubbles[1].id, 2);
  assert.strictEqual(track().bubbles[1].state, 'todo');
  assert.match(run('show').stdout, /^B {3}S F/); // current is now the child, titled after the parent bubble
  assert.match(run('switch', 'track').stdout, /B ⑂ b-sub\.json/);
  assert.match(run('fork', '2', 'again').stderr, /already forked/);
  assert.match(run('fork', '3', 'b-sub').stderr, /already exists/);
  // ids survive reordering and are never reused
  run('move', '2', 'to', '1');
  assert.deepStrictEqual(track().bubbles.map((b) => b.id), [2, 1, 3]);
  run('remove', '3');
  run('add', 'D');
  assert.deepStrictEqual(track().bubbles.map((b) => b.id), [2, 1, 4]);
  // the label shows where the bubble is now, and falls back to its title once it's gone
  run('switch', 'b-sub');
  assert.match(run('show').stdout, /fork of #1 "B" in track\.json/);
  run('switch', 'track');
  assert.match(run('remove', '1').stderr, /"B" has an open fork or side track: b-sub\.json — close or delete it first/);
  assert.match(run('fog', '1').stderr, /"B" has an open fork: b-sub\.json/);
  run('close', 'b-sub', '--force'); // a closed fork no longer holds its bubble
  assert.strictEqual(run('remove', '1').status, 0);
  run('switch', 'b-sub');
  assert.match(run('show').stdout, /fork of "B" in track\.json/);
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
  run('move', '1', 'to', '3');
  run('rename', '3', 'A2');
  assert.match(run('switch', 'side-a').stdout, /↗ diverged from #3 "A2" in track\.json/);
});

test('diverge takes an optional title; fork refuses one', () => {
  const { run } = repo();
  assert.match(run('diverge', '1', 'side', 'Web', 'UI').stdout, /^Web UI {3}S F/m);
  assert.match(run('tracks').stdout, /side +Web UI/);
  run('switch', 'track');
  const fork = run('fork', '1', 'sub', 'Other');
  assert.strictEqual(fork.status, 1);
  assert.match(fork.stderr, /fork takes no title/);
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

test('abilities: bubble:<name> prints the workflow; project beats user; broken and missing ones explain', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-abilities-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-home-'));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  const write = (base, name, text) => {
    fs.mkdirSync(path.join(base, '.bubble-tracks', 'abilities'), { recursive: true });
    fs.writeFileSync(path.join(base, '.bubble-tracks', 'abilities', `${name}.md`), text);
  };
  run('init', 'P');
  run('add', 'Login');
  run('hint', '1', 'OAuth only');
  run('add', '?');
  assert.match(run('abilities').stdout, /^no abilities yet — add <name>\.md to /);
  assert.match(run('bubble:research').stderr, /no ability "research" \(none yet/);
  write(home, 'research', '---\ndescription: user one\ntype: track\n---\nUser research.\n');
  write(home, 'verify', '---\nname: check\ntype: bubble\n---\nRun the tests.\n');
  write(home, 'bad', '---\ntype: nope\n---\nx\n');
  write(dir, 'research', '---\ndescription: Research the bubble\ntype: bubble\n---\nLook it up.\n');

  const r = run('/bubble:research', 'the', 'auth', 'flow');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^ability "research" \(type: bubble\)/);
  assert.match(r.stdout, /Research the bubble/);
  assert.match(r.stdout, /the human adds: the auth flow/);
  assert.match(r.stdout, /\n\nLook it up\.\n\n── context: active bubble on track "track" — P ──\n#1 "Login" \(todo\)\n↳ OAuth only\n\n↺ one-off — run the workflow above once on this bubble, /);
  assert.doesNotMatch(r.stdout, /User research/);

  const list = run('abilities').stdout.split('\n');
  assert.deepStrictEqual(list.slice(0, 3).map((l) => l.trim().split(/\s+/).slice(0, 3)), [
    ['bad', 'broken', 'user'],
    ['check', 'bubble', 'user'],
    ['research', 'bubble', 'project'],
  ]);
  assert.match(list[2], /Research the bubble$/);
  assert.match(list[0], /type must be bubble or track/);

  assert.match(run('bubble:check').stdout, /Run the tests\./); // frontmatter name beats the filename
  assert.match(run('bubble:bad').stderr, /ability "bad" is broken .*type must be bubble or track/);
  assert.match(run('bubble:nope').stderr, /abilities: bad, check, research/);
  assert.match(run('bubble:').stderr, /usage: bubble:<ability>/);

  // type: track gets the whole track, and exits 0 even when the active bubble is fog
  write(dir, 'review', '---\ntype: track\n---\nReview it.\n');
  run('done');
  const t = run('bubble:review');
  assert.strictEqual(t.status, 0);
  assert.match(t.stdout, /Review it\.\n\n── context: track "track" — P ──\nP {3}S/);
  assert.match(t.stdout, /→ 2 .* fog/);
  assert.match(t.stdout, /is fog — the human plans it/);
  assert.match(t.stdout, /\n\n↺ one-off — run the workflow above once on this track, .*invokes it\.\n$/);

  // type: bubble needs an active bubble, and prints nothing when there is none
  run('remove', '2');
  const none = run('bubble:research');
  assert.strictEqual(none.status, 1);
  assert.strictEqual(none.stdout, '');
  assert.match(none.stderr, /track "track" has no active bubble — a bubble ability needs one/);
});
