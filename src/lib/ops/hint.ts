// The human's note on a bubble.

import { resolve, type Addr, type Track } from '../model';

/** Attach a note to a bubble; "-" or empty clears it. */
export function hint(track: Track, addr: Addr, text: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (!text || text === '-') {
    delete b.hint;
    return `cleared hint on "${b.title}"`;
  }
  b.hint = text;
  return `hint on "${b.title}": ${text}`;
}
