// What the track is for (its goal) and what not to do on the way (its guards), set by the plan step.
/** Set the track's goal: the one end result every bubble serves. It's set once: a new goal is a new track,
 *  and only force (after the human confirms) rewords it. */
export function setGoal(track, text, { force = false } = {}) {
    if (!text)
        throw new Error('goal needs text');
    const old = track.goal;
    if (text === '-')
        throw new Error('a goal is set once and can\'t be cleared — a new goal is a new track: diverge <name>');
    if (old && !force) {
        throw new Error(`track already has a goal: "${old}" — a new goal is a new track: diverge <name>. To reword it, confirm with the human, then re-run with --force`);
    }
    track.goal = text;
    return old ? `goal "${old}" → "${text}"` : `goal: ${text}`;
}
/** Add a guard (a rule of what not to do); "N -" drops guard N, "-" drops them all. */
export function guard(track, text) {
    if (!text)
        throw new Error('guard needs text (or N - to drop guard N, - to drop all)');
    const guards = track.guards || [];
    if (text === '-') {
        delete track.guards;
        return guards.length ? `dropped ${guards.length} guard${guards.length === 1 ? '' : 's'}` : 'no guards to drop';
    }
    const drop = /^(\d+) -$/.exec(text);
    if (drop) {
        const n = Number(drop[1]);
        if (!guards[n - 1])
            throw new Error(`no guard ${n}`);
        const [old] = guards.splice(n - 1, 1);
        if (guards.length)
            track.guards = guards;
        else
            delete track.guards;
        return `dropped guard ${n}: ${old}`;
    }
    track.guards = [...guards, text];
    return `guard ${track.guards.length}: ${text}`;
}
