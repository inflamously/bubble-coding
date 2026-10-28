// Bubble-level commands: act on the current track (show, add, insert, remove, move, fog, fill, done, ...),
// or with --to on another one (add, insert, hint write into it; move sends bubbles to it).

import * as fs from 'node:fs';
import * as lib from '../index.js';
import * as links from '../links/index.js';
import { isAddr, isRange, needAddr, type Ctx } from './args.js';
import { printGuards, printTrack } from './print.js';

const STOP =
  '⏸ stop — show this track to the human and wait. They may move, insert, remove, rename, hint or fog ' +
  'bubbles before the next one starts.';

/** Every bubble-level command, so an unknown one is named before any track is looked up. */
const COMMANDS = ['show', 'status', 'add', 'insert', 'remove', 'rm', 'move', 'mv', 'rename', 'handoff', 'goal', 'guard', 'title', 'hint', 'finding', 'fog', 'type', 'why', 'answer', 'fill', 'done'];

/** Commands that take --to <track>: add, insert and hint write into it; move sends bubbles to it. */
const TO_COMMANDS = ['add', 'insert', 'hint', 'move', 'mv'];

/** The current track, loaded; throws when there is none or it can't be read. */
export function currentTrack(dir: string): lib.Found & { track: lib.Track } {
  const found = lib.findTrack(dir);
  if (!found) {
    const bubblesDir = lib.findBubblesDir(dir);
    const names = bubblesDir ? lib.listTracks(bubblesDir) : [];
    if (!bubblesDir || !names.length) throw new Error(`no bubble track found from ${dir} — start one with: switch <name>`);
    throw new Error(`current track "${lib.currentName(bubblesDir)}" not found — use: switch <name> (tracks: ${names.join(', ')})`);
  }
  if (!found.track) throw new Error(`invalid ${found.file}: ${found.error}`);
  return found as lib.Found & { track: lib.Track };
}

/** The --to track, loaded; it must already exist. Whether it is current doesn't change. */
function namedTrack(dir: string, name: string): lib.Found & { track: lib.Track } {
  lib.checkName(name);
  const bubblesDir = lib.findBubblesDir(dir);
  const file = bubblesDir && lib.trackPath(bubblesDir, name);
  if (!bubblesDir || !file || !fs.existsSync(file)) throw new Error(`no track "${name}" — create it first: create ${name}`);
  try {
    return { file, name, bubblesDir, track: lib.loadTrack(file) };
  } catch (err) {
    throw new Error(`invalid ${file}: ${(err as Error).message}`);
  }
}

/** add/insert words: `? [why]` is fog with its reason; `--fog [title]` still names the fog; anything else is a todo. */
function addBubble(track: lib.Track, args: string[], fog: boolean | undefined, at: lib.Addr): string {
  if (args[0] === '?') return lib.add(track, undefined, { fog: true, at, why: args.slice(1).join(' ') || undefined });
  return lib.add(track, args.join(' ') || undefined, { fog, at });
}

/** The bubbles at N or N:M (omitted: the active one), for checks that need them before the op runs. */
function picked(track: lib.Track, spec: lib.Addr): lib.Bubble[] {
  const [from, to] = spec === undefined ? [lib.resolve(track), lib.resolve(track)] : lib.resolveRange(track, spec);
  return track.bubbles.slice(from, to + 1);
}

const closedError = (name: string) => new Error(`track "${name}" is closed (read-only) — fork, diverge or switch to keep working`);

/** guard words: `drop N` · `drop --all` drop, `N <text>` rewrites guard N, anything else is a new guard. */
function guardWords(track: lib.Track, args: string[], { all, force }: Ctx['opts']): string {
  const [first, ...rest] = args;
  if (first === 'drop') {
    if (all && !rest.length) return lib.dropAllGuards(track, { force });
    if (all || rest.length !== 1 || !isAddr(rest[0])) throw new Error('usage: guard drop N | guard drop --all');
    return lib.dropGuard(track, Number(rest[0]));
  }
  const n = isAddr(first) ? Number(first) : null;
  const text = (n === null ? args : rest).join(' ');
  if (!text) throw new Error(n === null ? 'guard needs text (guard N <text> rewrites guard N; guard drop N | --all drops)' : `guard ${n} needs text: guard ${n} <text> rewrites it (guard drop ${n} drops it)`);
  if (text === '-') throw new Error('guards drop with: guard drop N | guard drop --all');
  return n === null ? lib.addGuard(track, text) : lib.rewriteGuard(track, n, text);
}

/** Run a bubble-level command on the current track (or the --to track); returns an exit code. */
export function runBubbleCommand(cmd: string, args: string[], { dir, opts, renderOpts }: Ctx): number {
  if (!COMMANDS.includes(cmd)) throw new Error(`unknown command "${cmd}" — try: help`);
  if (opts.to !== undefined && !TO_COMMANDS.includes(cmd)) throw new Error(`--to works only with add, insert, hint and move`);
  // add, insert and hint --to change the --to track; move --to takes from the current one.
  const into = opts.to !== undefined && cmd !== 'move' && cmd !== 'mv';
  const found = into ? namedTrack(dir, opts.to!) : currentTrack(dir);
  const { file, track } = found;

  let msg: string;
  let before: (() => void) | undefined; // another track's save, run once nothing can be refused any more
  let after: (() => string) | undefined; // cross-track follow-up (fork links), run once this track is saved
  let stop = false;
  switch (cmd) {
    case 'show':
    case 'status':
      return printTrack(file, track, renderOpts);
    case 'add':
      msg = addBubble(track, args, opts.fog, opts.at);
      break;
    case 'insert': {
      if (args[0] === 'at') args.shift();
      const at = needAddr(args, 'insert at N <title> | insert at N ? [why]');
      msg = addBubble(track, args, opts.fog, at);
      break;
    }
    case 'remove':
    case 'rm':
      if (!isRange(args[0])) throw new Error('usage: remove N | remove N:M');
      links.checkLinksClosed(file, picked(track, args[0]), { sides: true });
      msg = lib.remove(track, args[0]);
      break;
    case 'move':
    case 'mv': {
      const usage = 'usage: move N to M | move N:M to M | move N:M --to <track>';
      if (!isRange(args[0])) throw new Error(usage);
      const spec = args.shift();
      if (opts.to !== undefined) {
        if (args.length) throw new Error(usage);
        const target = namedTrack(dir, opts.to);
        if (target.file === file) throw new Error(`"${target.name}" is the current track — use: move N to M`);
        if (target.track.closed) throw closedError(target.name);
        msg = lib.moveTo(track, spec, target.track, target.name);
        msg += `\n\n${lib.render(target.track, renderOpts)}`; // its own block, like the current track's below
        before = () => lib.saveTrack(target.file, target.track); // first: a crash in between duplicates, never loses
        break;
      }
      if (args[0] === 'to') args.shift();
      if (!isAddr(args[0])) throw new Error(usage);
      msg = lib.move(track, spec, args[0]);
      break;
    }
    case 'rename': {
      const addr = needAddr(args, 'rename N <title>');
      msg = lib.rename(track, addr, args.join(' '));
      after = () => links.syncForkTitle(file, track.bubbles[lib.resolve(track, addr)]);
      break;
    }
    case 'handoff':
      msg = lib.setHandoff(track, args.join(' '));
      if (track.handoff) msg += ` — in a fresh chat run: /bubble switch ${found.name}`;
      break;
    case 'goal':
      msg = lib.setGoal(track, args.join(' '), { force: opts.force });
      break;
    case 'guard':
      if (args[0] === 'show') {
        if (args.length > 1) throw new Error('usage: guard show (it takes nothing else)');
        if (track.guards && track.guards.length) printGuards(track, renderOpts);
        else console.log('no guards — add one: guard <text>');
        return 0;
      }
      msg = guardWords(track, args, opts);
      break;
    case 'title':
      msg = lib.setTitle(track, args.join(' '));
      after = () => links.syncTitle(file, track);
      break;
    case 'hint': {
      const addr = needAddr(args, 'hint N <text> | hint N -');
      msg = lib.hint(track, addr, args.join(' '));
      break;
    }
    case 'finding': {
      const addr = needAddr(args, 'finding N <text> | finding N M - | finding N -');
      msg = lib.finding(track, addr, args.join(' '));
      break;
    }
    case 'fog': {
      const spec = isRange(args[0]) ? args.shift() : undefined;
      links.checkLinksClosed(file, picked(track, spec));
      msg = lib.fog(track, spec, args[0], { force: opts.force });
      break;
    }
    case 'type': {
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      msg = lib.setType(track, addr, args[0]);
      break;
    }
    case 'why':
    case 'answer': {
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      msg = (cmd === 'why' ? lib.setWhy : lib.setAnswer)(track, addr, args.join(' '));
      break;
    }
    case 'fill': {
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      msg = lib.fill(track, addr, args.join(' '));
      break;
    }
    case 'done': {
      const active = lib.activeBubble(track);
      if (active) links.checkForkFinished(file, active, { force: opts.force });
      msg = lib.done(track);
      // The last done closes the track (no ask), then a finished fork pops its parent bubble.
      after = () => [...links.closeIfDone(file, track), ...links.popFinishedParents(file, track)].join('\n');
      stop = true;
      break;
    }
    default:
      throw new Error(`unknown command "${cmd}" — try: help`);
  }
  // A closed track is archived: every change above is refused before anything is written.
  if (track.closed) throw closedError(found.name);
  if (into) msg += ` — on track "${found.name}"; the current track stays "${lib.currentName(found.bubblesDir)}"`;
  if (before) before();
  lib.saveTrack(file, track);
  const linked = after ? after() : '';
  console.log(linked ? `${msg}\n${linked}` : msg);
  console.log('');
  printTrack(file, track, renderOpts, cmd === 'guard');
  if (stop && lib.activeBubble(track)) {
    console.log('');
    console.log(STOP);
  }
  return 0; // exit 3 is reserved for `show`, so a successful mutation never looks like an error
}
