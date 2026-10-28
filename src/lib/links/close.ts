// Closing: a closed track is finished and read-only for good, and so is every fork under it (side tracks stay open).

import * as path from 'node:path';
import { saveTrack } from '../store.js';
import type { Track } from '../model.js';
import { forkTree, type Fork } from './tree.js';

/** What closing forks has to say: one line per fork, and one error per fork that couldn't be closed. */
export interface ClosedForks {
  lines: string[];
  errors: string[];
}

/** `"<name>"` of a track file. */
export const trackLabel = (file: string) => `"${path.basename(file, '.json')}"`;

/** Close every open fork in `forks` (from forkTree), top down; one line each. One failing fork doesn't stop the rest. */
export function closeForks(forks: Fork[], at: string): ClosedForks {
  const lines: string[] = [];
  const errors: string[] = [];
  for (const f of forks) {
    if (!f.track) lines.push(`  fork ${trackLabel(f.file)}: ${f.problem}`);
    else if (f.track.closed) lines.push(`  fork ${trackLabel(f.file)}: already closed`);
    else {
      try {
        f.track.closed = { at };
        saveTrack(f.file, f.track);
        lines.push(`  closed fork ${trackLabel(f.file)}`);
      } catch (err) {
        errors.push(`  fork ${trackLabel(f.file)}: not closed (${(err as Error).message}) — re-run close to retry`);
      }
    }
  }
  return { lines, errors };
}

/** All bubbles done (an empty track isn't) -> close the track and its open forks. Returns the lines to print, none if it stays open. */
export function closeIfDone(file: string, track: Track): string[] {
  if (track.closed || !track.bubbles.length || !track.bubbles.every((b) => b.state === 'done')) return [];
  const at = new Date().toISOString();
  track.closed = { at };
  saveTrack(file, track);
  const open = forkTree(file, track).filter((f) => !f.track || !f.track.closed);
  const { lines, errors } = closeForks(open, at);
  return [`all done — closed track ${trackLabel(file)}: read-only from now on; a follow-up is a diverge or a new track`, ...lines, ...errors];
}
