// Bubble-level commands: act on the current track (show, add, insert, remove, move, fog, fill, done, ...).

import T = require('../track');
import links = require('../links');
import { isAddr, isRange, needAddr, type Ctx } from './args';
import { printTrack } from './print';

const STOP =
  '⏸ stop — show this track to the human and wait. They may move, insert, remove, rename, hint or fog ' +
  'bubbles before the next one starts.';

/** Run a bubble-level command on the current track; returns an exit code. */
export function runBubbleCommand(cmd: string, args: string[], { dir, opts, renderOpts }: Ctx): number {
  const found = T.findTrack(dir);
  if (!found) {
    const bubblesDir = T.findBubblesDir(dir);
    const names = bubblesDir ? T.listTracks(bubblesDir) : [];
    if (!bubblesDir || !names.length) throw new Error(`no bubble track found from ${dir} — start one with: switch <name>`);
    throw new Error(`current track "${T.currentName(bubblesDir)}" not found — use: switch <name> (tracks: ${names.join(', ')})`);
  }
  if (!found.track) throw new Error(`invalid ${found.file}: ${found.error}`);
  const { file, track } = found;

  let msg: string;
  let after: (() => string) | undefined; // cross-track follow-up (fork links), run once this track is saved
  let stop = false;
  switch (cmd) {
    case 'show':
    case 'status':
      return printTrack(file, track, renderOpts);
    case 'add': {
      const fog = opts.fog || (args.length === 1 && args[0] === '?');
      msg = T.add(track, fog && args[0] === '?' ? undefined : args.join(' '), { fog, at: opts.at });
      break;
    }
    case 'insert': {
      if (args[0] === 'at') args.shift();
      const at = needAddr(args, 'insert at N <title> | insert at N ?');
      const fog = opts.fog || (args.length === 1 && args[0] === '?');
      msg = T.add(track, fog && args[0] === '?' ? undefined : args.join(' '), { fog, at });
      break;
    }
    case 'remove':
    case 'rm':
      if (!isRange(args[0])) throw new Error('usage: remove N | remove N:M');
      msg = T.remove(track, args[0]);
      break;
    case 'move':
    case 'mv': {
      if (!isRange(args[0])) throw new Error('usage: move N to M | move N:M to M');
      const spec = args.shift();
      if (args[0] === 'to') args.shift();
      if (!isAddr(args[0])) throw new Error('usage: move N to M | move N:M to M');
      msg = T.move(track, spec, args[0]);
      break;
    }
    case 'rename': {
      const addr = needAddr(args, 'rename N <title>');
      msg = T.rename(track, addr, args.join(' '));
      after = () => links.syncForkTitle(file, track.bubbles[T.resolve(track, addr)]);
      break;
    }
    case 'handoff':
      msg = T.setHandoff(track, args.join(' '));
      if (track.handoff) msg += ` — in a fresh chat run: /bubble switch ${found.name}`;
      break;
    case 'title':
      msg = T.setTitle(track, args.join(' '));
      after = () => links.syncTitle(file, track);
      break;
    case 'hint': {
      const addr = needAddr(args, 'hint N <text> | hint N -');
      msg = T.hint(track, addr, args.join(' '));
      break;
    }
    case 'fog': {
      const spec = isRange(args[0]) ? args.shift() : undefined;
      msg = T.fog(track, spec, args[0], { force: opts.force });
      break;
    }
    case 'type': {
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      msg = T.setType(track, addr, args[0]);
      break;
    }
    case 'fill': {
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      msg = T.fill(track, addr, args.join(' '));
      break;
    }
    case 'done': {
      const active = T.activeBubble(track);
      if (active) links.checkForkFinished(file, active, { force: opts.force });
      msg = T.done(track);
      after = () => links.popFinishedParents(file, track).join('\n');
      stop = true;
      break;
    }
    default:
      throw new Error(`unknown command "${cmd}" — try: help`);
  }
  // A closed track is archived: every change above is refused before anything is written.
  if (track.closed) throw new Error(`track "${found.name}" is closed (read-only) — fork, diverge or switch to keep working`);
  T.saveTrack(file, track);
  const linked = after ? after() : '';
  console.log(linked ? `${msg}\n${linked}` : msg);
  console.log('');
  printTrack(file, track, renderOpts);
  if (stop && T.activeBubble(track)) {
    console.log('');
    console.log(STOP);
  }
  return 0; // exit 3 is reserved for `show`, so a successful mutation never looks like an error
}
