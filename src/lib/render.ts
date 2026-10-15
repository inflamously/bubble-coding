// Rendering: the one-line track (status line, `tracks`) and the numbered listing (`show`).

import { activeIndex, type Bubble, type Track } from './model';

export interface RenderOpts {
  ascii?: boolean; // undefined = BUBBLES_ASCII decides
  color?: boolean;
}

type Symbols = Record<'done' | 'active' | 'todo' | 'fog' | 'sep' | 'prev' | 'next' | 'more' | 'fork' | 'side', string>;

export const SYMBOLS: { unicode: Symbols; ascii: Symbols } = {
  unicode: { done: '●', active: '◐', todo: '○', fog: '❓', sep: '──', prev: ' ‹ ', next: ' › ', more: '…', fork: '⑂', side: '↗' },
  ascii: { done: '*', active: '@', todo: 'o', fog: '?', sep: '--', prev: ' < ', next: ' > ', more: '...', fork: 'Y', side: '/' },
};

// ANSI colors: title dark green, track blue, prev ‹ active › next dark yellow.
const COLORS = { title: '\x1b[32m', track: '\x1b[34m', context: '\x1b[33m', reset: '\x1b[0m' };
const paint = (on: boolean, color: 'title' | 'track' | 'context', text: string) =>
  on && text ? `${COLORS[color]}${text}${COLORS.reset}` : text;

/** Color is opt-in per call (opts.color); NO_COLOR always wins. */
function useColor(opts?: RenderOpts): boolean {
  if (process.env.NO_COLOR) return false;
  return !!(opts && opts.color);
}

function symbolsFor(opts?: RenderOpts): Symbols {
  const ascii = opts && typeof opts.ascii === 'boolean' ? opts.ascii : process.env.BUBBLES_ASCII === '1';
  return ascii ? SYMBOLS.ascii : SYMBOLS.unicode;
}

function symbolFor(bubble: Bubble, isActive: boolean, sym: Symbols): string {
  if (bubble.state === 'fog') return sym.fog;
  if (bubble.state === 'done') return sym.done;
  if (isActive || bubble.state === 'active') return sym.active;
  return sym.todo;
}

const LABEL_MAX = 20;

/** Cut a title to LABEL_MAX chars, at a word boundary when there is one. */
export function shorten(title: string | undefined, sym: Symbols): string {
  const text = String(title || '').trim();
  if (text.length <= LABEL_MAX) return text;
  const room = LABEL_MAX - sym.more.length;
  const cut = text.slice(0, room + 1).lastIndexOf(' ');
  return text.slice(0, cut > room / 2 ? cut : room).trimEnd() + sym.more;
}

/** One-line render: `Title   S ●──●──◐──❓ F   prev ‹ ◐ active › next` */
export function render(track: Track, opts?: RenderOpts): string {
  const sym = symbolsFor(opts);
  const bubbles = track.bubbles || [];
  const index = activeIndex(track);
  const color = useColor(opts);
  const line = bubbles.map((b, i) => symbolFor(b, i === index, sym)).join(sym.sep);
  const head = `${paint(color, 'title', track.title || 'Plan')}   ${paint(color, 'track', `S ${line}${line ? ' ' : ''}F`)}   `;
  const active = bubbles[index];
  if (!active) return head + paint(color, 'context', 'all done');
  const prev = bubbles[index - 1];
  const next = bubbles[index + 1];
  const here = active.state === 'fog' ? `${sym.fog} needs you` : `${sym.active} ${shorten(active.title, sym)}`;
  const context = (prev ? shorten(prev.title, sym) + sym.prev : '') + here + (next ? sym.next + shorten(next.title, sym) : '');
  return head + paint(color, 'context', context);
}

/** Multi-line listing of the track, with addressable indexes. */
export function list(track: Track, opts?: RenderOpts): string {
  const sym = symbolsFor(opts);
  const index = activeIndex(track);
  return (track.bubbles || [])
    .map((b, i) => {
      const mark = i === index ? '→' : ' ';
      const type = b.type ? ` [${b.type}]` : '';
      const fork = (b.fork ? ` ${sym.fork} ${b.fork}` : '') + (b.sides || []).map((s) => ` ${sym.side} ${s}`).join('');
      const hint = b.hint ? `\n        ↳ ${b.hint}` : '';
      return `${mark} ${String(i + 1).padEnd(3)} ${symbolFor(b, i === index, sym)} ${b.state.padEnd(6)} ${b.title}${type}${fork}${hint}`;
    })
    .join('\n');
}
