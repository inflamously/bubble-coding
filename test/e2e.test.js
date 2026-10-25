// End to end: build a development track by running every CLI command in turn, as an agent would.
// Each command is its own test, named after it, with its output in the report.
// BUBBLES_TRANSCRIPT=<file> also writes the rendered session there, as material for the flow analysis.
import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'skills', 'bubble', 'scripts', 'cli', 'bubble.js');

/** A temp repo and an empty home, so the user's own abilities never leak in. */
function session() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-e2e-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-e2e-home-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home, BUBBLES_ASCII: '' };
  const transcript = [];
  /** A test that runs one command, reports its output, and checks the exit code and every pattern. */
  const step = (args, patterns = [], status = 0) => {
    const cmd = `bubble ${args.join(' ')}`;
    it(status ? `${cmd} → exit ${status}` : cmd, (t) => {
      const r = spawnSync(process.execPath, [CLI, '--dir', dir, ...args], { encoding: 'utf8', env });
      const out = (r.stdout + r.stderr).trimEnd();
      transcript.push(`$ ${cmd}\n${out}\n[exit ${r.status}]`);
      for (const line of out.split('\n')) t.diagnostic(line);
      assert.strictEqual(r.status, status, `${cmd}\n${out}`);
      for (const p of [patterns].flat()) assert.match(out, p, cmd);
    });
  };
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, '.bubble-tracks', `${name}.json`), 'utf8'));
  const exists = (name) => fs.existsSync(path.join(dir, '.bubble-tracks', `${name}.json`));
  return { dir, step, read, exists, transcript };
}

describe('e2e: a development track from sketch to close', () => {
  // One session for the whole story: the tests below run in order, each building on the last.
  const { dir, step, read, exists, transcript } = session();
  after(() => {
    if (process.env.BUBBLES_TRANSCRIPT) fs.writeFileSync(process.env.BUBBLES_TRANSCRIPT, transcript.join('\n\n') + '\n');
  });

  describe('sketch a track with one fog bubble', () => {
    step(['show'], /switch <name>/, 1);
    step(['frobnicate'], /unknown command "frobnicate" — try: help/, 1); // named even with no track yet
    step(['create', 'dev', 'Dev track'], [/created track "dev"/, /Dev track {3}S F/]);
    step(['create', 'dev'], /track "dev" already exists — use: switch dev/, 1);
    step(['add', 'Parse input'], [/added bubble "Parse input"/, /→ 1 {3}◐ todo {3}Parse input/]);
    step(['add', '?'], [/added fog "\?\?\?" — no reason yet, say why it's unclear: why 2 <text>/, /S ◐──❓ F/]);
    step(['add', 'Write output'], /S ◐──❓──○ F/);
    step(['insert', 'at', '2', 'Validate'], [/added bubble "Validate"/, /2 {3}○ todo {3}Validate/]);
    step(['hint', '1', 'read stdin'], [/hint on "Parse input": read stdin/, /↳ read stdin/]);
    step(['hint', '2', '--', '-v prints each rule'], /↳ -v prints each rule/);
    step(['hint', '2', '-'], /cleared hint on "Validate"/);
    step(['rename', '2', 'Check input'], /renamed "Validate" → "Check input"/);
  });

  describe('plan: goal and guards on the track', () => {
    step(['goal', 'Parse and check input'], [/goal: Parse and check input/, /⚑ goal: Parse and check input/]);
    step(['goal', 'Parse input'], /already has a goal: "Parse and check input" — a new goal is a new track: diverge <name>/, 1);
    step(['goal', '-'], /a goal is set once and can't be cleared/, 1);
    step(['goal', 'Parse input', '--force'], /goal "Parse and check input" → "Parse input"/);
    step(['goal', 'Parse and check input', '--force'], /⚑ goal: Parse and check input/);
    step(['guard', 'show'], /no guards — add one: guard <text>/);
    step(['guard', 'no new deps'], [/guard 1: no new deps/, /¦ guards \(before you act\):\n {4}1 {2}no new deps/]);
    step(['guard', '--', '-v stays verbose'], / {4}2 {2}-v stays verbose/);
    step(['guard', '1', 'no new runtime deps'], [/guard 1: "no new deps" → "no new runtime deps"/, / {4}1 {2}no new runtime deps\n {4}2 {2}-v stays verbose/]);
    step(['guard', '3'], /guard 3 needs text: guard 3 <text> rewrites it/, 1);
    step(['guard', '9', 'x'], /no guard 9 — guard N <text> rewrites guard N/, 1);
    step(['guard', 'show', 'extra'], /usage: guard show/, 1);
    step(['guard', '2', '-'], /guards drop with: guard drop N \| guard drop --all/, 1);
    step(['guard', 'drop', '1', 'x'], /usage: guard drop N \| guard drop --all/, 1);
    step(['guard', 'drop', '9'], /no guard 9/, 1);
    step(['guard', 'drop', '2'], /dropped guard 2: -v stays verbose/);
    step(['guard', 'drop', '--all'], /dropping all 1 guard — confirm with the human, then re-run with --force\n {4}1 {2}no new runtime deps/, 1);
    step(['guard', '1', 'no new deps'], /guard 1: "no new runtime deps" → "no new deps"/);
    step(['guard', 'show'], /^¦ guards \(before you act\):\n {4}1 {2}no new deps$/);
    it('show prints the goal but not the guards', () => {
      const r = spawnSync(process.execPath, [CLI, '--dir', dir, 'show'], { encoding: 'utf8' });
      assert.match(r.stdout, /⚑ goal: Parse and check input/);
      assert.doesNotMatch(r.stdout, /guards/);
    });
    it('dev.json holds the goal and guards', () => {
      assert.strictEqual(read('dev').goal, 'Parse and check input');
      assert.deepStrictEqual(read('dev').guards, ['no new deps']);
    });
  });

  describe('classify and fill the fog', () => {
    step(['rename', '3', 'Guess'], /"\?\?\?" is fog — plan it with fill/, 1); // fog is the human's to plan
    step(['why', '3', 'no output format chosen'], [/why on "\?\?\?": no output format chosen/, /\n {8}why: no output format chosen/]);
    step(['why', '1', 'x'], /"Parse input" isn't fog — use hint for a note on it/, 1);
    step(['type', '3', 'ku'], [/classified as known-unknown/, /❓ fog {4}\?\?\? \[known-unknown\]/]);
    step(['answer', '3', 'json or csv, whatever the team reads'], [/answer on "\?\?\?": json or csv/, /\n {8}human: json or csv, whatever the team reads/]);
    step(['fill', '3', 'Pick format'], [/filled "Pick format"/, /S ◐──○──○──○ F/, /why: no output format chosen\n {8}human: json or csv/]);
    it('the filled bubble keeps why and answer, as the trail of how it was planned', () => {
      const b = read('dev').bubbles[2];
      assert.strictEqual(b.why, 'no output format chosen');
      assert.strictEqual(b.answer, 'json or csv, whatever the team reads');
    });
  });

  describe('research: the workflow, then findings on the bubble', () => {
    step(['research', '2', 'rule', 'syntax'], [/research #2 "Check input" — run this once/, /the human adds: rule syntax/, /finding 2 <tip — source>/, /── context: bubble #2 on track "dev"/, /⏸ stop/]);
    step(['finding', '2', 'reuse the parser rules — src/rules.ts'], [/finding 1 on "Check input": reuse the parser rules/, /\n {8}found 1: reuse the parser rules — src\/rules.ts/]);
    step(['finding', '2', 'fail fast on the first bad rule — node:assert docs'], /found 2: fail fast/);
    step(['finding', '2', '2', '-'], /dropped finding 2 on "Check input"/);
    step(['research', '2'], /found 1: reuse the parser rules/);
    step(['finding', '9', 'x'], /no bubble at "9"/, 1);
    it('dev.json holds the finding on the bubble', () => {
      assert.deepStrictEqual(read('dev').bubbles[1].findings, ['reuse the parser rules — src/rules.ts']);
    });
  });

  describe('reshape: fog, move, remove, handoff, title', () => {
    step(['fog', '4'], /"Write output" is now fog/);
    step(['move', '4', 'to', '1'], [/moved "Write output" to 1/, /⚠ "Write output" is fog/]);
    step(['show'], /❓ needs you/, 3); // the fog gate
    step(['switch', 'dev'], /⚠ "Write output" is fog/); // warns, but exit 3 is show's alone
    step(['answer', 'maybe stdout'], [/answer on "Write output": maybe stdout/, /Their words above are the start/]);
    step(['answer', '1', '-'], /cleared answer on "Write output"/);
    step(['answer', '1', '-'], /no answer on "Write output" to clear/);
    step(['move', '1', 'to', '4'], /S ◐──○──○──❓ F/);
    step(['remove', '4'], [/removed "Write output"/, /S ◐──○──○ F/]);
    step(['insert', 'at', '3', '?', 'no writer picked yet'], [/added fog "\?\?\?" — why: no writer picked yet/, /S ◐──○──❓──○ F/]);
    step(['remove', '3'], /S ◐──○──○ F/);
    step(['handoff', 'next: parse'], [/switch dev/, /✎ handoff \(.+\): next: parse/]);
    step(['title', 'Dev flow'], /track "Dev track" → "Dev flow"/);
    it('dev.json holds the three todo bubbles', () => {
      assert.deepStrictEqual(read('dev').bubbles.map((b) => [b.title, b.state]), [
        ['Parse input', 'todo'],
        ['Check input', 'todo'],
        ['Pick format', 'todo'],
      ]);
    });
  });

  describe('walk: done stops for the human', () => {
    step(['done'], [/popped "Parse input"/, /S ●──◐──○ F/, /⏸ stop/]);
  });

  describe('fork: finishing the child pops its bubble', () => {
    step(['fork', '2', 'dev-check'], [/forked "Check input" into track "dev-check"/, /⑂ fork of #2 "Check input" in dev.json/]);
    step(['show'], /Check input {3}S F {3}empty/); // an empty track isn't all done
    step(['done'], /the track is empty — add a bubble first/, 1);
    step(['add', 'Rule list'], /→ 1 {3}◐ todo {3}Rule list/);
    step(['done'], [/popped "Rule list"/, /fork finished — popped "Check input" in dev.json/]);
    step(['switch', 'dev'], [/resumed track "dev"/, /2 {3}● done {3}Check input ⑂ dev-check.json/, /✎ handoff/]);
    step(['switch', 'dev', 'Other'], /resumed track "dev" — the title stays "Dev flow"; to rename it: title Other/);
  });

  describe('diverge: a side track nothing waits for', () => {
    step(['diverge', '2', 'dev-alt', 'Alt idea'], [/diverged from "Check input" into track "dev-alt"/, /↗ diverged from #2/]);
    step(['add', 'Spike'], /◐ Spike/);
    step(['switch', 'dev'], /Check input ⑂ dev-check.json ↗ dev-alt.json/);
    step(['remove', '2'], /"Check input" has an open fork or side track: dev-check.json, dev-alt.json — close or delete it first/, 1);
    step(['fog', '2', '--force'], /"Check input" has an open fork: dev-check.json — close or delete it first/, 1);
  });

  describe('--to: record work on another track', () => {
    step(['add', 'Extra', '--to', 'dev-alt'], /added bubble "Extra" — on track "dev-alt"; the current track stays "dev"/);
    step(['hint', '2', 'from dev', '--to', 'dev-alt'], /↳ from dev/);
    step(['move', '3', '--to', 'dev-alt'], [/moved "Pick format" to track "dev-alt"\n\nAlt idea {3}S /, /Dev flow {3}S ●──● F {3}all done/]);
    it('the moved bubble keeps its fog type', () => {
      assert.deepStrictEqual(read('dev-alt').bubbles.map((b) => b.title), ['Spike', 'Extra', 'Pick format']);
      assert.strictEqual(read('dev-alt').bubbles[2].type, 'known-unknown');
    });
  });

  describe('abilities: list and apply one', () => {
    step(['abilities'], /no abilities yet/);
    it('write a project ability, check.md', () => {
      fs.mkdirSync(path.join(dir, '.bubble-tracks', 'abilities'));
      fs.writeFileSync(
        path.join(dir, '.bubble-tracks', 'abilities', 'check.md'),
        '---\nname: check\ndescription: Check the bubble\ntype: bubble\n---\nRestate the bubble.\n',
      );
    });
    step(['abilities'], /check {12}bubble {2}project {2}Check the bubble/);
    step(['switch', 'dev-alt'], /resumed track "dev-alt"/);
    step(['bubble:check', 'focus', 'on', 'X'], [/ability "check" \(type: bubble\)/, /the human adds: focus on X/, /Restate the bubble\./, /#1 "Spike" \(todo\)/, /↺ one-off/]);
    step(['bubble:nope'], /no ability "nope"/, 1);
  });

  describe('tracks, close and delete', () => {
    step(['tracks'], [/→ dev-alt {10}Alt idea/, /  dev {14}Dev flow/, /  dev-check {8}Check input/]);
    step(['close', 'dev-alt'], /confirm with the human/, 1);
    step(['close', 'dev-alt', '--force'], [/closed track "dev-alt"/, /🔒 closed/]);
    step(['add', 'Late'], /track "dev-alt" is closed/, 1);
    step(['research', '1'], /track "dev-alt" is closed \(read-only\) — its bubbles can't take findings/, 1);
    step(['switch', 'dev'], /resumed track "dev"/);
    step(['remove', '2'], /"Check input" has an open fork or side track: dev-check.json — close/, 1); // closed dev-alt no longer holds it
    step(['tracks'], /1 closed hidden/);
    step(['tracks', '--closed'], /dev-alt .*🔒 closed/);
    step(['delete', 'dev-alt'], /confirm with the human/, 1);
    step(['delete', 'dev-alt', '--force'], /deleted track "dev-alt"/);
    it('dev-alt.json is gone', () => assert.ok(!exists('dev-alt')));
    step(['close', 'dev', '--force'], [/closed track "dev"/, /closed fork "dev-check"/]);
    step(['tracks', '--all'], [/dev {14}Dev flow .*🔒 closed/, /dev-check .*🔒 closed/]);
  });

  describe('init: the default track next to named ones', () => {
    step(['init', 'P'], /created track "track"/);
    step(['add', 'One'], /→ 1 {3}◐ todo {3}One/);
  });
});
