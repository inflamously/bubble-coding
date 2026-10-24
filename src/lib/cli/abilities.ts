// Ability commands: abilities lists them; bubble:<name> (or /bubble:<name>) prints that ability's
// workflow for the agent to run once, followed by its context: the active bubble or the whole track.

import * as path from 'node:path';
import * as lib from '../index.js';
import type { Ctx } from './args.js';
import { currentTrack } from './bubbles.js';
import { printTrack } from './print.js';

const INVOKE_RE = /^\/?bubble:(.*)$/;

/** The footer: what "run once" means, for whichever agent reads the output. */
const ONE_OFF = (type: lib.AbilityType) =>
  `↺ one-off — run the workflow above once on this ${type}, then report back to the human. ` +
  'Change the track only through the CLI, and never fill fog yourself. Nothing stays attached: ' +
  'the ability runs again only when the human invokes it.';

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

/** The ability's context, checked before anything prints: the current track, and for type: bubble its active bubble. */
function loadContext(ability: lib.Ability, dir: string): { found: lib.Found & { track: lib.Track }; index: number } {
  const found = currentTrack(dir);
  const { name, track } = found;
  const index = track.closed ? -1 : lib.activeIndex(track);
  if (ability.type === 'bubble' && index === -1) {
    throw new Error(`track "${name}" has no active bubble${track.closed ? ' (closed)' : ''} — a bubble ability needs one`);
  }
  return { found, index };
}

/** Print the context: the active bubble (type: bubble) or the whole track (type: track). */
function printContext(ability: lib.Ability, { found, index }: ReturnType<typeof loadContext>, { renderOpts }: Ctx): void {
  const { file, name, track } = found;
  const title = track.title ? ` — ${track.title}` : '';
  if (ability.type === 'track') {
    console.log(`── context: track "${name}"${title} ──`);
    printTrack(file, track, renderOpts); // its fog exit code is show's business, not the ability's
    return;
  }
  const b = track.bubbles[index];
  console.log(`── context: active bubble on track "${name}"${title} ──`);
  console.log(`#${index + 1} "${b.title}" (${b.state}${b.type ? `, ${b.type}` : ''})`);
  if (b.hint) console.log(`↳ ${b.hint}`);
  (b.findings || []).forEach((f, n) => console.log(`found ${n + 1}: ${f}`));
}

/** Run an ability command; returns an exit code, or undefined if `cmd` isn't one. */
export function runAbilityCommand(cmd: string, args: string[], ctx: Ctx): number | undefined {
  const { dir } = ctx;
  if (cmd === 'abilities') return printAbilities(dir);
  const m = INVOKE_RE.exec(cmd);
  if (!m) return undefined;
  if (!m[1]) throw new Error('usage: bubble:<ability> [text]');
  const ability = lib.findAbility(dir, m[1]);
  const context = loadContext(ability, dir);
  console.log(`ability "${ability.name}" (type: ${ability.type}) — run this workflow once, on the active ${ability.type}`);
  if (ability.description) console.log(ability.description);
  console.log(`from ${ability.file}`);
  if (args.length) console.log(`the human adds: ${args.join(' ')}`);
  console.log('');
  console.log(ability.body);
  console.log('');
  printContext(ability, context, ctx);
  console.log('');
  console.log(ONE_OFF(ability.type));
  return 0;
}
