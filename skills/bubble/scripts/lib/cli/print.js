// What `show` and every mutation print: the track line, the goal (and guards on switch or guard), the listing, the handoff note or closed line, the fog warning.
import * as lib from '../index.js';
import * as links from '../links/index.js';
/** The track's guards, numbered; nothing when it has none. */
export function printGuards(track, opts) {
    if (!track.guards || !track.guards.length)
        return;
    console.log(`${lib.symbolsFor(opts).guard} guards (check before done):`);
    track.guards.forEach((g, i) => console.log(`    ${i + 1}  ${g}`));
}
/**
 * Print the track saved at `file`; returns 3 when the active bubble is fog (the human has to plan it), else 0.
 * Guards print only with `guards` (switch and the guard command); otherwise `guard show` lists them.
 */
export function printTrack(file, track, opts, guards = false) {
    console.log(lib.render(track, opts));
    const { fork, side } = lib.SYMBOLS.unicode;
    if (track.parent)
        console.log(`${fork} fork of ${links.linkLabel(file, track.parent)} in ${track.parent.track}`);
    if (track.origin)
        console.log(`${side} diverged from ${links.linkLabel(file, track.origin)} in ${track.origin.track}`);
    if (track.goal)
        console.log(`${lib.symbolsFor(opts).goal} goal: ${track.goal}`);
    if (guards)
        printGuards(track, opts);
    console.log('');
    console.log(lib.list(track, opts));
    if (track.closed) {
        console.log('');
        console.log(`${lib.SYMBOLS.unicode.lock} closed ${track.closed.at} — read-only; fork, diverge or switch to keep working`);
        return 0; // archived: nothing is active, so fog here never needs the human
    }
    if (track.handoff && track.handoff.note) {
        console.log('');
        console.log(`✎ handoff (${track.handoff.at}): ${track.handoff.note}`);
    }
    const active = lib.activeBubble(track);
    if (active && active.state === 'fog') {
        console.log('');
        console.log(`⚠ "${active.title}" is fog — the human plans it. Ask them to classify it (${lib.TYPES.join(', ')}) and fill it.`);
        if (active.answer)
            console.log('  Their words above are the start: turn them, with the human, into a fill, a hint, a guard, new bubbles or a fork.');
        return 3;
    }
    return 0;
}
