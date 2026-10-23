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
    step(['create', 'dev', 'Dev track'], [/created track "dev"/, /Dev track {3}S F/]);
    step(['create', 'dev'], /track "dev" already exists — use: switch dev/, 1);
    step(['add', 'Parse input'], [/added bubble "Parse input"/, /→ 1 {3}◐ todo {3}Parse input/]);
    step(['add', '?'], [/added fog "\?\?\?"/, /S ◐──❓ F/]);
    step(['add', 'Write output'], /S ◐──❓──○ F/);
    step(['insert', 'at', '2', 'Validate'], [/added bubble "Validate"/, /2 {3}○ todo {3}Validate/]);
    step(['hint', '1', 'read stdin'], [/hint on "Parse input": read stdin/, /↳ read stdin/]);
    step(['hint', '2', '--', '-v prints each rule'], /↳ -v prints each rule/);
    step(['hint', '2', '-'], /cleared hint on "Validate"/);
    step(['rename', '2', 'Check input'], /renamed "Validate" → "Check input"/);
  });

  describe('classify and fill the fog', () => {
    step(['rename', '3', 'Guess'], /"\?\?\?" is fog — plan it with fill/, 1); // fog is the human's to plan
    step(['type', '3', 'ku'], [/classified as known-unknown/, /❓ fog {4}\?\?\? \[known-unknown\]/]);
    step(['fill', '3', 'Pick format'], [/filled "Pick format"/, /S ◐──○──○──○ F/]);
  });

  describe('reshape: fog, move, remove, handoff, title', () => {
    step(['fog', '4'], /"Write output" is now fog/);
    step(['move', '4', 'to', '1'], [/moved "Write output" to 1/, /⚠ "Write output" is fog/]);
    step(['show'], /❓ needs you/, 3); // the fog gate
    step(['move', '1', 'to', '4'], /S ◐──○──○──❓ F/);
    step(['remove', '4'], [/removed "Write output"/, /S ◐──○──○ F/]);
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
    step(['done'], /all bubbles are already done/, 1); // an empty track reads as all done
    step(['add', 'Rule list'], /→ 1 {3}◐ todo {3}Rule list/);
    step(['done'], [/popped "Rule list"/, /fork finished — popped "Check input" in dev.json/]);
    step(['switch', 'dev'], [/resumed track "dev"/, /2 {3}● done {3}Check input ⑂ dev-check.json/, /✎ handoff/]);
  });

  describe('diverge: a side track nothing waits for', () => {
    step(['diverge', '2', 'dev-alt', 'Alt idea'], [/diverged from "Check input" into track "dev-alt"/, /↗ diverged from #2/]);
    step(['add', 'Spike'], /◐ Spike/);
    step(['switch', 'dev'], /Check input ⑂ dev-check.json ↗ dev-alt.json/);
  });

  describe('--to: record work on another track', () => {
    step(['add', 'Extra', '--to', 'dev-alt'], /added bubble "Extra" — on track "dev-alt"; the current track stays "dev"/);
    step(['hint', '2', 'from dev', '--to', 'dev-alt'], /↳ from dev/);
    step(['move', '3', '--to', 'dev-alt'], [/moved "Pick format" to track "dev-alt"/, /Dev flow {3}S ●──● F {3}all done/]);
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
    step(['switch', 'dev'], /resumed track "dev"/);
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
