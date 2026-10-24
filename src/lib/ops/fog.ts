// The fog lifecycle: turn bubbles into fog, say why, classify them, keep the human's words, fill them with their content.

import { normalizeType, checkType, resolve, resolveRange, type Addr, type Track } from '../model.js';

/** Turn a bubble (or N:M range) into fog. Done bubbles need `force`. */
export function fog(track: Track, spec: Addr, type?: string, { force = false }: { force?: boolean } = {}): string {
  type = normalizeType(type);
  checkType(type);
  const [from, to] = spec === undefined ? [resolve(track), resolve(track)] : resolveRange(track, spec);
  const picked = track.bubbles.slice(from, to + 1);
  const finished = picked.filter((b) => b.state === 'done');
  if (finished.length && !force) {
    throw new Error(
      `${finished.map((b) => `"${b.title}"`).join(', ')} ${finished.length > 1 ? 'are' : 'is'} done — ` +
        'confirm with the human, then re-run with --force'
    );
  }
  for (const b of picked) {
    b.state = 'fog';
    if (type) b.type = type;
  }
  return picked.length === 1 ? `"${picked[0].title}" is now fog` : `bubbles ${from + 1}–${to + 1} are now fog`;
}

export function setType(track: Track, addr: Addr, type: string | undefined): string {
  if (!type) throw new Error('type needs a value');
  type = normalizeType(type);
  checkType(type);
  const b = track.bubbles[resolve(track, addr)];
  b.type = type;
  return `"${b.title}" classified as ${type}`;
}

/** A fog-only text field, set or cleared ("-" or empty). */
function setFogText(track: Track, addr: Addr, field: 'why' | 'answer', text: string, label: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state !== 'fog') throw new Error(`"${b.title}" isn't fog — use hint for a note on it`);
  if (!text || text === '-') {
    if (b[field] === undefined) return `no ${label} on "${b.title}" to clear`;
    delete b[field];
    return `cleared ${label} on "${b.title}"`;
  }
  b[field] = text;
  return `${label} on "${b.title}": ${text}`;
}

/** Why a fog bubble is unclear: one line, set when the fog is made. */
export function setWhy(track: Track, addr: Addr, text: string): string {
  return setFogText(track, addr, 'why', text, 'why');
}

/** The human's own words on a fog bubble that stays fog, kept as they said them. */
export function setAnswer(track: Track, addr: Addr, text: string): string {
  return setFogText(track, addr, 'answer', text, 'answer');
}

/** Human-planned content for a fog bubble: fog -> todo. `why` and `answer` stay, as the trail of how it was planned. */
export function fill(track: Track, addr: Addr, title: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state !== 'fog') throw new Error(`"${b.title}" isn't fog — use rename to change its title`);
  if (!title) throw new Error('fill needs a title');
  b.title = title;
  b.state = 'todo';
  return `filled "${b.title}"`;
}
