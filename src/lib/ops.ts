// Track mutations: each changes the track in place and returns a short message for the CLI.

import { normalizeType, checkType, activeIndex, resolve, resolveRange, ensureId, type Bubble, type Track } from './model';

type Addr = string | number | undefined;

export function add(track: Track, title: string | undefined, { fog = false, at }: { fog?: boolean; at?: Addr } = {}): string {
  const bubbles = track.bubbles;
  const bubble: Bubble = fog ? { title: title || '???', state: 'fog' } : { title: title || '', state: 'todo' };
  if (!bubble.title) throw new Error('add needs a title');
  if (at !== undefined) {
    const pos = Number(at) - 1;
    if (!Number.isInteger(pos) || pos < 0 || pos > bubbles.length) throw new Error(`bad position "${at}"`);
    bubbles.splice(pos, 0, bubble);
  } else {
    bubbles.push(bubble);
  }
  ensureId(track, bubble);
  return `added ${fog ? 'fog' : 'bubble'} "${bubble.title}"`;
}

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

/** Human-planned content for a fog bubble: fog -> todo. */
export function fill(track: Track, addr: Addr, title: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state !== 'fog') throw new Error(`"${b.title}" isn't fog — use rename to change its title`);
  if (!title) throw new Error('fill needs a title');
  b.title = title;
  b.state = 'todo';
  return `filled "${b.title}"`;
}

export function rename(track: Track, addr: Addr, title: string): string {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state === 'fog') throw new Error(`"${b.title}" is fog — plan it with fill`);
  if (!title) throw new Error('rename needs a title');
  const old = b.title;
  b.title = title;
  return `renamed "${old}" → "${title}"`;
}

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

export function remove(track: Track, spec: Addr): string {
  const [from, to] = resolveRange(track, spec);
  const gone = track.bubbles.splice(from, to - from + 1);
  return `removed ${gone.map((b) => `"${b.title}"`).join(', ')}`;
}

/** Move a bubble (or N:M block) so it starts at position `to` in the resulting track. */
export function move(track: Track, spec: Addr, to: string | number): string {
  const [from, last] = resolveRange(track, spec);
  const block = track.bubbles.splice(from, last - from + 1);
  const pos = Number(to) - 1;
  if (!Number.isInteger(pos) || pos < 0 || pos > track.bubbles.length) {
    track.bubbles.splice(from, 0, ...block); // undo
    throw new Error(`bad position "${to}"`);
  }
  track.bubbles.splice(pos, 0, ...block);
  return `moved ${block.map((b) => `"${b.title}"`).join(', ')} to ${pos + 1}`;
}

/**
 * Move a bubble (or N:M block) to the end of another track, state, type and hint included. They get new ids
 * from `target`'s counter. Bubbles with a fork or side track are refused: those tracks link back here by id.
 */
export function moveTo(track: Track, spec: Addr, target: Track, targetName: string): string {
  const [from, last] = resolveRange(track, spec);
  const linked = track.bubbles.slice(from, last + 1).filter((b) => b.fork || b.sides?.length);
  if (linked.length) {
    throw new Error(
      `${linked.map((b) => `"${b.title}"`).join(', ')} ${linked.length > 1 ? 'have' : 'has'} a fork or side track ` +
        'linked to this track — it stays here'
    );
  }
  const block = track.bubbles.splice(from, last - from + 1);
  for (const { title, state, id: _old, ...rest } of block) {
    const b: Bubble = { title, state }; // the new id goes right after state, as on every other bubble
    ensureId(target, b);
    target.bubbles.push(Object.assign(b, rest));
  }
  return `moved ${block.map((b) => `"${b.title}"`).join(', ')} to track "${targetName}"`;
}

/** Save (or clear with "-") the note a fresh chat reads to pick this track back up. */
export function setHandoff(track: Track, note: string, now = new Date()): string {
  if (!note) throw new Error('handoff needs a note (or - to clear it)');
  if (note === '-') {
    delete track.handoff;
    return 'cleared the handoff note';
  }
  track.handoff = { note, at: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
  return 'saved the handoff note';
}

/** Rename the track itself. */
export function setTitle(track: Track, title: string): string {
  if (!title) throw new Error('title needs text');
  const old = track.title;
  track.title = title;
  return `track "${old}" → "${title}"`;
}

/** Link a bubble to the child track forked from it; its state stays as is. Returns the bubble (with its id). */
export function markFork(track: Track, addr: Addr, childRef: string): Bubble & { id: number } {
  const b = track.bubbles[resolve(track, addr)];
  if (b.state === 'done') throw new Error(`"${b.title}" is done — nothing left to fork`);
  if (b.fork) throw new Error(`"${b.title}" is already forked to ${b.fork}`);
  const id = ensureId(track, b);
  b.fork = childRef;
  return Object.assign(b, { id });
}

/** Link a bubble to a side track that went a different direction from it. Any state; the bubble doesn't wait for it. */
export function markDiverge(track: Track, addr: Addr, childRef: string): Bubble & { id: number } {
  const b = track.bubbles[resolve(track, addr)];
  const id = ensureId(track, b);
  b.sides = [...(b.sides || []), childRef];
  return Object.assign(b, { id });
}

/** Mark the active bubble done. */
export function done(track: Track): string {
  const i = activeIndex(track);
  if (i === -1) throw new Error('all bubbles are already done');
  const b = track.bubbles[i];
  if (b.state === 'fog') throw new Error(`"${b.title}" is fog — plan it with the human first`);
  b.state = 'done';
  return `popped "${b.title}"`;
}
