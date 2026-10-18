// Delete bubbles.

import { resolveRange, type Addr, type Track } from '../model';

export function remove(track: Track, spec: Addr): string {
  const [from, to] = resolveRange(track, spec);
  const gone = track.bubbles.splice(from, to - from + 1);
  return `removed ${gone.map((b) => `"${b.title}"`).join(', ')}`;
}
