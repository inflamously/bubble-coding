// Ability commands: abilities lists them; bubble:<name> (or /bubble:<name>) prints that ability's
// workflow for the agent to run once.

import path = require('node:path');
import lib = require('../index');
import type { Ctx } from './args.js';

const INVOKE_RE = /^\/?bubble:(.*)$/;

/** One line per ability: name, type (or broken), project or user, description (or the problem). */
function printAbilities(dir: string): number {
  const entries = lib.listAbilities(dir);
  if (!entries.length) {
    console.log(`no abilities yet — add <name>.md to ${lib.abilityDirs(dir).join(' or ')}`);
    return 0;
  }
  const bubblesDir = lib.findBubblesDir(dir);
  const projectDir = bubblesDir && path.join(bubblesDir, lib.ABILITY_DIR);
  for (const e of entries) {
    const from = projectDir && path.dirname(e.file) === projectDir ? 'project' : 'user';
    const kind = e.ability ? e.ability.type : 'broken';
    const text = e.ability ? e.ability.description : e.problem;
    console.log(`  ${e.name.padEnd(16)} ${kind.padEnd(7)} ${from.padEnd(8)} ${text}`);
  }
  console.log('');
  console.log('run one with: bubble:<name> [text]');
  return 0;
}

/** Run an ability command; returns an exit code, or undefined if `cmd` isn't one. */
export function runAbilityCommand(cmd: string, args: string[], { dir }: Ctx): number | undefined {
  if (cmd === 'abilities') return printAbilities(dir);
  const m = INVOKE_RE.exec(cmd);
  if (!m) return undefined;
  if (!m[1]) throw new Error('usage: bubble:<ability> [text]');
  const ability = lib.findAbility(dir, m[1]);
  console.log(`ability "${ability.name}" (type: ${ability.type}) — run this workflow once, on the active ${ability.type}`);
  if (ability.description) console.log(ability.description);
  console.log(`from ${ability.file}`);
  if (args.length) console.log(`the human adds: ${args.join(' ')}`);
  console.log('');
  console.log(ability.body);
  return 0;
}
