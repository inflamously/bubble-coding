// The installer's arguments: agents as words, options from node:util parseArgs, short errors.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTALL = path.join(__dirname, '..', 'install.js');
const run = (...args) => spawnSync(process.execPath, [INSTALL, ...args], { encoding: 'utf8' });

test('installer arguments: unknown words and options, a missing --project value, help', () => {
  assert.match(run('nope').stderr, /^install: unknown argument "nope"$/m);
  assert.match(run('claude', '--bogus').stderr, /^install: unknown argument "--bogus"$/m);
  assert.match(run('claude', '-v').stderr, /^install: unknown argument "-v"$/m);
  assert.match(run('claude', '--project').stderr, /^install: --project needs a value$/m);
  assert.match(run('claude', '--user', '--project', '.').stderr, /either --user or --project/);
  for (const args of [['--help'], ['-h'], []]) assert.match(run(...args).stdout, /^bubble-tracks installer/, args.join(' '));
});

test('installer --dry-run with all agents (twice) and --project=<dir> writes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-install-'));
  const r = run('all', 'claude', '--dry-run', `--project=${dir}`);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`project: ${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}  \\(dry run\\)`));
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});
