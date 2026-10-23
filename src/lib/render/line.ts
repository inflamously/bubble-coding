// The one-line track: the status line and `tracks`, plus the status line's guard count.

import { activeIndex, type Track } from '../model.js';
import { paint, shorten, symbolFor, symbolsFor, useColor, type RenderOpts } from './symbols.js';

/** One-line render: `Title   S ●──●──◐──❓ F   prev ‹ ◐ active › next`, or `… F   🔒 closed` (nothing active). */
export function render(track: Track, opts?: RenderOpts): string {
  const sym = symbolsFor(opts);
  const bubbles = track.bubbles || [];
  const index = track.closed ? -1 : activeIndex(track);
  const color = useColor(opts);
  const line = bubbles.map((b, i) => symbolFor(b, i === index, sym)).join(sym.sep);
  const head = `${paint(color, 'title', track.title || 'Plan')}   ${paint(color, 'track', `S ${line}${line ? ' ' : ''}F`)}   `;
  if (track.closed) return head + paint(color, 'context', `${sym.lock} closed`);
  const active = bubbles[index];
  if (!active) return head + paint(color, 'context', 'all done');
  const prev = bubbles[index - 1];
  const next = bubbles[index + 1];
  const here = active.state === 'fog' ? `${sym.fog} needs you` : `${sym.active} ${shorten(active.title, sym)}`;
  const context = (prev ? shorten(prev.title, sym) + sym.prev : '') + here + (next ? sym.next + shorten(next.title, sym) : '');
  return head + paint(color, 'context', context);
}

/** The status line's guard count after the line: `   ¦ 2 guards`, or '' when the track has none. */
export function renderGuardCount(track: Track, opts?: RenderOpts): string {
  const count = (track.guards || []).length;
  if (!count) return '';
  const sym = symbolsFor(opts);
  return '   ' + paint(useColor(opts), 'context', `${sym.guard} ${count} guard${count === 1 ? '' : 's'}`);
}
