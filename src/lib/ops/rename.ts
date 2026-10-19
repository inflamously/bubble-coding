// Retitle a bubble or the track itself.

import { resolve, type Addr, type Track } from '../model.js';

export function rename(track: Track, addr: Addr, title: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state === 'fog') throw new Error(`"${b.title}" is fog — plan it with fill`);
  if (!title) throw new Error('rename needs a title');
  const old = b.title;
  b.title = title;
  return `renamed "${old}" → "${title}"`;
}

/** Rename the track itself. */
export function setTitle(track: Track, title: string): string {
  if (!title) throw new Error('title needs text');
  const old = track.title;
  track.title = title;
  return `track "${old}" → "${title}"`;
}
