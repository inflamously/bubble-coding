// What the track is for (its goal) and what not to do on the way (its guards), set by the plan step.

import type { Track } from '../model.js';

/** Set the track's goal: the one end result every bubble serves; "-" clears it. */
export function setGoal(track: Track, text: string): string {
  if (!text) throw new Error('goal needs text (or - to clear it)');
  if (text === '-') {
    delete track.goal;
    return 'cleared the goal';
  }
  track.goal = text;
  return `goal: ${text}`;
}

/** Add a guard (a rule of what not to do); "N -" drops guard N, "-" drops them all. */
export function guard(track: Track, text: string): string {
  if (!text) throw new Error('guard needs text (or N - to drop guard N, - to drop all)');
  const guards = track.guards || [];
  if (text === '-') {
    delete track.guards;
    return guards.length ? `dropped ${guards.length} guard${guards.length === 1 ? '' : 's'}` : 'no guards to drop';
  }
  const drop = /^(\d+) -$/.exec(text);
  if (drop) {
    const n = Number(drop[1]);
    if (!guards[n - 1]) throw new Error(`no guard ${n}`);
    const [old] = guards.splice(n - 1, 1);
    if (guards.length) track.guards = guards;
    else delete track.guards;
    return `dropped guard ${n}: ${old}`;
  }
  track.guards = [...guards, text];
  return `guard ${track.guards.length}: ${text}`;
}
