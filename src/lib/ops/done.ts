// Pop the active bubble.

import { activeIndex, type Track } from '../model.js';

/** Mark the active bubble done. */
export function done(track: Track): string {
  const i = activeIndex(track);
  if (i === -1) throw new Error('all bubbles are already done');
  const b = track.bubbles[i];
  if (b.state === 'fog') throw new Error(`"${b.title}" is fog — plan it with the human first`);
  b.state = 'done';
  return `popped "${b.title}"`;
}
