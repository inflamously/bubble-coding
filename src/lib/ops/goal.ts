// What the track is for (its goal), set once by the plan step.

import type { Track } from '../model.js';

/** Set the track's goal: the one end result every bubble serves. It's set once: a new goal is a new track,
 *  and only force (after the human confirms) rewords it. */
export function setGoal(track: Track, text: string, { force = false }: { force?: boolean } = {}): string {
  if (!text) throw new Error('goal needs text');
  const old = track.goal;
  if (text === '-') throw new Error('a goal is set once and can\'t be cleared — a new goal is a new track: diverge <name>');
  if (old && !force) {
    throw new Error(`track already has a goal: "${old}" — a new goal is a new track: diverge <name>. To reword it, confirm with the human, then re-run with --force`);
  }
  track.goal = text;
  return old ? `goal "${old}" → "${text}"` : `goal: ${text}`;
}
