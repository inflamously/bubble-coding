// What not to do on the way (the track's guards), set by the plan step and read before acting.

import type { Track } from '../model.js';

const guardCount = (n: number) => `${n} guard${n === 1 ? '' : 's'}`;

/** The track's guards, checked to hold guard n (1-based). */
function guardsWith(track: Track, n: number, what = ''): string[] {
  const guards = track.guards;
  if (!guards || guards[n - 1] === undefined) throw new Error(`no guard ${n}${what}`);
  return guards;
}

/** Append a guard: a rule of what not to do. */
export function addGuard(track: Track, text: string): string {
  track.guards = [...(track.guards || []), text];
  return `guard ${track.guards.length}: ${text}`;
}

/** Rewrite guard n in place, keeping its position. */
export function rewriteGuard(track: Track, n: number, text: string): string {
  const guards = guardsWith(track, n, " — guard N <text> rewrites guard N; a new guard can't start with a number");
  const old = guards[n - 1];
  guards[n - 1] = text;
  return `guard ${n}: "${old}" → "${text}"`;
}

/** Drop guard n; the field goes when it ends up empty. */
export function dropGuard(track: Track, n: number): string {
  const guards = guardsWith(track, n);
  const [old] = guards.splice(n - 1, 1);
  if (!guards.length) delete track.guards;
  return `dropped guard ${n}: ${old}`;
}

/** Drop every guard; needs force, after the human confirms. */
export function dropAllGuards(track: Track, { force = false }: { force?: boolean } = {}): string {
  const guards = track.guards || [];
  if (!guards.length) return 'no guards to drop';
  if (!force) {
    const list = guards.map((g, i) => `\n    ${i + 1}  ${g}`).join('');
    throw new Error(`dropping all ${guardCount(guards.length)} — confirm with the human, then re-run with --force${list}`);
  }
  delete track.guards;
  return `dropped ${guardCount(guards.length)}`;
}
