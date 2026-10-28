// Track-level commands: which track is current (init, create, switch, tracks, close, delete, fork, diverge).

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as lib from '../index.js';
import * as links from '../links/index.js';
import { isAddr, type Ctx } from './args.js';
import { printTrack } from './print.js';

/** Open track names: a closed one only shows read-only, so it's no slip target. Unreadable ones count. */
function openTracks(bubblesDir: string): string[] {
  return lib.listTracks(bubblesDir).filter((name) => {
    try {
      return !lib.loadTrack(lib.trackPath(bubblesDir, name)).closed;
    } catch {
      return true;
    }
  });
}

/** Refuse a new track whose name looks like a slip for an open one; `create` still makes it. */
function refuseNearMiss(bubblesDir: string, name: string): void {
  const near = lib.nearMisses(name, openTracks(bubblesDir));
  if (!near.length) return;
  const list = near.map((n) => `"${n}"`).join(', ');
  throw new Error(`no track "${name}" — did you mean ${list}? To resume: switch ${near[0]}. For a new track: create ${name}`);
}

/** Run a track-level command; returns an exit code, or undefined if `cmd` isn't one. */
export function runTrackCommand(cmd: string, args: string[], { dir, opts, renderOpts }: Ctx): number | undefined {
  const bubblesDir = lib.findBubblesDir(dir) || path.join(dir, lib.TRACK_DIR);

  const create = (name: string, title: string) => {
    lib.checkName(name);
    const file = lib.trackPath(bubblesDir, name);
    const track: lib.Track = { title: title || name, bubbles: [] };
    lib.saveTrack(file, track);
    lib.setCurrent(bubblesDir, name);
    console.log(`created track "${name}" (${file})`);
    console.log('');
    printTrack(file, track, renderOpts);
    return 0;
  };

  switch (cmd) {
    case 'init': {
      const file = lib.trackPath(bubblesDir, lib.DEFAULT_NAME);
      if (fs.existsSync(file)) throw new Error(`track already exists: ${file} — use: switch <name> for another track`);
      return create(lib.DEFAULT_NAME, args.join(' ') || path.basename(dir));
    }
    case 'create': {
      const name = lib.checkName(args.shift());
      if (fs.existsSync(lib.trackPath(bubblesDir, name))) throw new Error(`track "${name}" already exists — use: switch ${name}`);
      return create(name, args.join(' '));
    }
    case 'switch': {
      let name = args.shift();
      if (!name) {
        // bare switch: resume the current (last switched-to) track, else the default one
        name = [lib.currentName(bubblesDir), lib.DEFAULT_NAME].find((n) => fs.existsSync(lib.trackPath(bubblesDir, n)));
        if (!name) throw new Error('no tracks yet — start one with: switch <name>');
      }
      lib.checkName(name);
      const file = lib.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) {
        refuseNearMiss(bubblesDir, name);
        return create(name, args.join(' '));
      }
      const track = lib.loadTrack(file);
      lib.setCurrent(bubblesDir, name);
      const title = args.join(' ');
      // a title on an existing track isn't applied: say so, and how to rename it
      const kept = track.title ? `the title stays "${track.title}"` : 'it keeps no title';
      console.log(title && title !== track.title ? `resumed track "${name}" — ${kept}; to rename it: title ${title}` : `resumed track "${name}"`);
      console.log('');
      printTrack(file, track, renderOpts, true);
      return 0; // the fog warning still prints; exit 3 is show's alone
    }
    case 'tracks': {
      const names = lib.listTracks(bubblesDir);
      if (!names.length) {
        console.log('no tracks yet — start one with: switch <name>');
        return 0;
      }
      if (opts.closed && opts.all) throw new Error('tracks takes --closed or --all, not both');
      // By default closed tracks are hidden, except the current one; all-done-but-open tracks still show (they wait
      // to be closed). --closed lists only closed tracks, --all everything.
      const current = lib.currentName(bubblesDir);
      let hidden = 0;
      let shown = 0;
      for (const name of names) {
        let line;
        try {
          const track = lib.loadTrack(lib.trackPath(bubblesDir, name));
          const skip = opts.closed ? !track.closed : !opts.all && track.closed && name !== current;
          if (skip) {
            if (!opts.closed) hidden++;
            continue;
          }
          line = lib.render(track, renderOpts);
        } catch (err) {
          line = `invalid: ${(err as Error).message}`;
        }
        console.log(`${name === current ? '→' : ' '} ${name.padEnd(16)} ${line}`);
        shown++;
      }
      if (opts.closed && !shown) console.log('no closed tracks');
      if (hidden) console.log(`  ${hidden} closed hidden — tracks --all`);
      return 0;
    }
    case 'fork':
    case 'diverge': {
      // fork: build on the bubble (child.parent, the bubble waits). diverge: a different direction (child.origin, nothing waits).
      const found = lib.findTrack(dir);
      if (!found) throw new Error(`no current track to ${cmd} from — start one with: switch <name>`);
      if (!found.track) throw new Error(`invalid ${found.file}: ${found.error}`);
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      const name = lib.checkName(args.shift());
      // A side track can have its own title; a fork's title follows its bubble.
      const title = args.join(' ').trim();
      if (title && cmd === 'fork') throw new Error(`fork takes no title — the fork is titled after its bubble and stays in sync (diverge takes one)`);
      const childFile = lib.trackPath(bubblesDir, name);
      if (fs.existsSync(childFile)) throw new Error(`track "${name}" already exists — pick another name`);
      // References are relative paths with forward slashes, so tracks survive a moved checkout and other OSes.
      const rel = (from: string, to: string) => path.relative(path.dirname(from), to).split(path.sep).join('/');
      const bubble = (cmd === 'fork' ? lib.markFork : lib.markDiverge)(found.track, addr, rel(found.file, childFile));
      const link: lib.Link = { track: rel(childFile, found.file), bubble: bubble.id, title: bubble.title };
      const child: lib.Track = { title: title || bubble.title, [cmd === 'fork' ? 'parent' : 'origin']: link, bubbles: [] };
      lib.saveTrack(childFile, child);
      // A closed track stays untouched: the child links back to it, but it never learns about the child.
      if (!found.track.closed) lib.saveTrack(found.file, found.track);
      lib.setCurrent(bubblesDir, name);
      const verb = cmd === 'fork' ? 'forked' : 'diverged from';
      const from = found.track.closed ? ` of closed track "${found.name}"` : '';
      console.log(`${verb} "${bubble.title}"${from} into track "${name}" — a fresh track: ask the human what to do, sketch it, classify all fog`);
      console.log('');
      return printTrack(childFile, child, renderOpts);
    }
    case 'close': {
      // Closing cascades top down to every fork under the track, whatever its state; side tracks stay open.
      const name = lib.checkName(args.shift());
      const file = lib.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) throw new Error(`no track "${name}"`);
      const track = lib.loadTrack(file);
      const forks = links.forkTree(file, track);
      const open = forks.filter((f) => f.track && !f.track.closed);
      if (track.closed && !open.length) throw new Error(`track "${name}" is already closed`);
      if (!opts.force) {
        const also = open.length ? ` (and its forks ${open.map((f) => links.trackLabel(f.file)).join(', ')})` : '';
        throw new Error(`closing "${name}"${also} is permanent (read-only, no reopen) — confirm with the human, then re-run with --force`);
      }
      const at = new Date().toISOString();
      if (track.closed) {
        console.log(`track "${name}" is already closed — closing its open forks`);
      } else {
        track.closed = { at };
        lib.saveTrack(file, track);
        console.log(`closed track "${name}" — read-only from now on; fork, diverge or switch to keep working`);
        // A closed fork counts as finished, so its parent bubble pops (and on up the chain).
        for (const msg of links.popFinishedParents(file, track)) console.log(msg);
      }
      // Forks never pop anything: their parent is closed by now.
      const { lines, errors } = links.closeForks(forks, at);
      for (const line of lines) console.log(line);
      for (const err of errors) console.error(err);
      console.log('');
      printTrack(file, track, renderOpts);
      return errors.length ? 1 : 0;
    }
    case 'delete': {
      const name = lib.checkName(args.shift());
      const file = lib.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) throw new Error(`no track "${name}"`);
      if (name === lib.currentName(bubblesDir)) throw new Error(`"${name}" is the current track — switch to another one first`);
      if (!opts.force) throw new Error(`deleting "${name}" can't be undone — confirm with the human, then re-run with --force`);
      fs.unlinkSync(file);
      console.log(`deleted track "${name}"`);
      return 0;
    }
    default:
      return undefined;
  }
}
