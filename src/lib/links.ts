// Fork links between tracks: a forked bubble waits for its child, and the child's changes flow back to it.
// Links are relative paths (from the linking track file) plus the parent bubble's stable id.

import fs = require('node:fs');
import path = require('node:path');
import { loadTrack, saveTrack } from './store';
import type { Bubble, Track } from './model';

const linked = (fromFile: string, rel: string) => path.resolve(path.dirname(fromFile), rel);

/** A track is finished when it's closed, or has bubbles and all are done (an empty, unsketched track isn't). */
export const isFinished = (track: Track) =>
  !!track.closed || (track.bubbles.length > 0 && track.bubbles.every((b) => b.state === 'done'));

/** Throw if `bubble` has a fork that isn't finished yet; a missing child file needs `force`. */
export function checkForkFinished(file: string, bubble: Bubble, { force = false }: { force?: boolean } = {}): void {
  if (!bubble.fork) return;
  const childFile = linked(file, bubble.fork);
  if (!fs.existsSync(childFile)) {
    if (force) return;
    throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork}, which is missing — re-run with --force to pop it anyway`);
  }
  if (!isFinished(loadTrack(childFile))) {
    throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork} — finish that track first (switch to it)`);
  }
}

/** Load the parent track and the bubble a child was forked from, or null if the link is broken or the parent is closed. */
function parentOf(childFile: string, child: Track): { file: string; track: Track; bubble: Bubble } | null {
  if (!child.parent) return null;
  const file = linked(childFile, child.parent.track);
  if (!fs.existsSync(file)) return null;
  const track = loadTrack(file);
  if (track.closed) return null; // a closed parent is read-only: the child runs on, nothing flows back
  const bubble = track.bubbles.find((b) => b.id === child.parent!.bubble);
  return bubble ? { file, track, bubble } : null;
}

/** Child retitled -> the parent bubble takes the new title. Returns a message, or ''. */
export function syncTitle(childFile: string, child: Track): string {
  const p = parentOf(childFile, child);
  if (!p || !child.parent || !child.title || p.bubble.title === child.title) return '';
  p.bubble.title = child.title;
  child.parent.title = child.title;
  saveTrack(p.file, p.track);
  saveTrack(childFile, child);
  return `parent bubble #${p.bubble.id} in ${child.parent.track} renamed too`;
}

/** Parent bubble renamed -> its fork's title (and the child's copy of it) follow. Returns a message, or ''. */
export function syncForkTitle(file: string, bubble: Bubble): string {
  if (!bubble.fork) return '';
  const childFile = linked(file, bubble.fork);
  if (!fs.existsSync(childFile)) return '';
  const child = loadTrack(childFile);
  if (child.closed) return '';
  child.title = bubble.title;
  if (child.parent) child.parent.title = bubble.title;
  saveTrack(childFile, child);
  return `fork ${bubble.fork} renamed too`;
}

/** Child finished (or closed) -> pop its parent bubble, and so on up the chain. Returns one message per popped parent. */
export function popFinishedParents(childFile: string, child: Track): string[] {
  const msgs: string[] = [];
  for (let file = childFile, track = child; isFinished(track); ) {
    const p = parentOf(file, track);
    if (!p || p.bubble.state === 'done') break;
    p.bubble.state = 'done';
    saveTrack(p.file, p.track);
    msgs.push(`fork finished — popped "${p.bubble.title}" in ${path.relative(path.dirname(childFile), p.file).split(path.sep).join('/')}`);
    file = p.file;
    track = p.track;
  }
  return msgs;
}
