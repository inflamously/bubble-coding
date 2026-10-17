// Track-level commands: which track is current (init, create, switch, tracks, close, delete, fork, diverge).

import fs = require('node:fs');
import path = require('node:path');
import T = require('../track');
import links = require('../links');
import { isAddr, type Ctx } from './args';
import { printTrack } from './print';

/** Run a track-level command; returns an exit code, or undefined if `cmd` isn't one. */
export function runTrackCommand(cmd: string, args: string[], { dir, opts, renderOpts }: Ctx): number | undefined {
  const bubblesDir = T.findBubblesDir(dir) || path.join(dir, T.TRACK_DIR);

  const create = (name: string, title: string) => {
    T.checkName(name);
    const file = T.trackPath(bubblesDir, name);
    const track: T.Track = { title: title || name, bubbles: [] };
    T.saveTrack(file, track);
    T.setCurrent(bubblesDir, name);
    console.log(`created track "${name}" (${file})`);
    console.log('');
    printTrack(file, track, renderOpts);
    return 0;
  };

  switch (cmd) {
    case 'init': {
      const file = T.trackPath(bubblesDir, T.DEFAULT_NAME);
      if (fs.existsSync(file)) throw new Error(`track already exists: ${file} — use: switch <name> for another track`);
      return create(T.DEFAULT_NAME, args.join(' ') || path.basename(dir));
    }
    case 'create': {
      const name = T.checkName(args.shift());
      if (fs.existsSync(T.trackPath(bubblesDir, name))) throw new Error(`track "${name}" already exists — use: switch ${name}`);
      return create(name, args.join(' '));
    }
    case 'switch': {
      let name = args.shift();
      if (!name) {
        // bare switch: resume the current (last switched-to) track, else the default one
        name = [T.currentName(bubblesDir), T.DEFAULT_NAME].find((n) => fs.existsSync(T.trackPath(bubblesDir, n)));
        if (!name) throw new Error('no tracks yet — start one with: switch <name>');
      }
      T.checkName(name);
      const file = T.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) return create(name, args.join(' '));
      const track = T.loadTrack(file);
      T.setCurrent(bubblesDir, name);
      console.log(`resumed track "${name}"`);
      console.log('');
      return printTrack(file, track, renderOpts);
    }
    case 'tracks': {
      const names = T.listTracks(bubblesDir);
      if (!names.length) {
        console.log('no tracks yet — start one with: switch <name>');
        return 0;
      }
      const current = T.currentName(bubblesDir);
      for (const name of names) {
        let line;
        try {
          line = T.render(T.loadTrack(T.trackPath(bubblesDir, name)), renderOpts);
        } catch (err) {
          line = `invalid: ${(err as Error).message}`;
        }
        console.log(`${name === current ? '→' : ' '} ${name.padEnd(16)} ${line}`);
      }
      return 0;
    }
    case 'fork':
    case 'diverge': {
      // fork: build on the bubble (child.parent, the bubble waits). diverge: a different direction (child.origin, nothing waits).
      const found = T.findTrack(dir);
      if (!found) throw new Error(`no current track to ${cmd} from — start one with: switch <name>`);
      if (!found.track) throw new Error(`invalid ${found.file}: ${found.error}`);
      const addr = isAddr(args[0]) ? args.shift() : undefined;
      const name = T.checkName(args.shift());
      // A side track can have its own title; a fork's title follows its bubble.
      const title = args.join(' ').trim();
      if (title && cmd === 'fork') throw new Error(`fork takes no title — the fork is titled after its bubble and stays in sync (diverge takes one)`);
      const childFile = T.trackPath(bubblesDir, name);
      if (fs.existsSync(childFile)) throw new Error(`track "${name}" already exists — pick another name`);
      // References are relative paths with forward slashes, so tracks survive a moved checkout and other OSes.
      const rel = (from: string, to: string) => path.relative(path.dirname(from), to).split(path.sep).join('/');
      const bubble = (cmd === 'fork' ? T.markFork : T.markDiverge)(found.track, addr, rel(found.file, childFile));
      const link: T.Link = { track: rel(childFile, found.file), bubble: bubble.id, title: bubble.title };
      const child: T.Track = { title: title || bubble.title, [cmd === 'fork' ? 'parent' : 'origin']: link, bubbles: [] };
      T.saveTrack(childFile, child);
      // A closed track stays untouched: the child links back to it, but it never learns about the child.
      if (!found.track.closed) T.saveTrack(found.file, found.track);
      T.setCurrent(bubblesDir, name);
      const verb = cmd === 'fork' ? 'forked' : 'diverged from';
      const from = found.track.closed ? ` of closed track "${found.name}"` : '';
      console.log(`${verb} "${bubble.title}"${from} into track "${name}" — a fresh track: ask the human what to do, sketch it, classify all fog`);
      console.log('');
      return printTrack(childFile, child, renderOpts);
    }
    case 'close': {
      // Closing cascades top down to every fork under the track, whatever its state; side tracks stay open.
      const name = T.checkName(args.shift());
      const file = T.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) throw new Error(`no track "${name}"`);
      const track = T.loadTrack(file);
      const forks = links.forkTree(file, track);
      const open = forks.filter((f) => f.track && !f.track.closed);
      const label = (f: links.Fork) => `"${path.basename(f.file, '.json')}"`;
      if (track.closed && !open.length) throw new Error(`track "${name}" is already closed`);
      if (!opts.force) {
        const also = open.length ? ` (and its forks ${open.map(label).join(', ')})` : '';
        throw new Error(`closing "${name}"${also} is permanent (read-only, no reopen) — confirm with the human, then re-run with --force`);
      }
      const at = new Date().toISOString();
      if (track.closed) {
        console.log(`track "${name}" is already closed — closing its open forks`);
      } else {
        track.closed = { at };
        T.saveTrack(file, track);
        console.log(`closed track "${name}" — read-only from now on; fork, diverge or switch to keep working`);
        // A closed fork counts as finished, so its parent bubble pops (and on up the chain).
        for (const msg of links.popFinishedParents(file, track)) console.log(msg);
      }
      // Forks never pop anything: their parent is closed by now. One failing fork doesn't stop the rest.
      let failed = 0;
      for (const f of forks) {
        if (!f.track) console.log(`  fork ${label(f)}: ${f.problem}`);
        else if (f.track.closed) console.log(`  fork ${label(f)}: already closed`);
        else {
          try {
            f.track.closed = { at };
            T.saveTrack(f.file, f.track);
            console.log(`  closed fork ${label(f)}`);
          } catch (err) {
            failed++;
            console.error(`  fork ${label(f)}: not closed (${(err as Error).message}) — re-run close to retry`);
          }
        }
      }
      console.log('');
      printTrack(file, track, renderOpts);
      return failed ? 1 : 0;
    }
    case 'delete': {
      const name = T.checkName(args.shift());
      const file = T.trackPath(bubblesDir, name);
      if (!fs.existsSync(file)) throw new Error(`no track "${name}"`);
      if (name === T.currentName(bubblesDir)) throw new Error(`"${name}" is the current track — switch to another one first`);
      if (!opts.force) throw new Error(`deleting "${name}" can't be undone — confirm with the human, then re-run with --force`);
      fs.unlinkSync(file);
      console.log(`deleted track "${name}"`);
      return 0;
    }
    default:
      return undefined;
  }
}
