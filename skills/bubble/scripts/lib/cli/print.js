"use strict";
// What `show` and every mutation print: the track line, the listing, the handoff note, the fog warning.
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTrack = printTrack;
const T = require("../track");
/** Print the track; returns 3 when the active bubble is fog (the human has to plan it), else 0. */
function printTrack(track, opts) {
    console.log(T.render(track, opts));
    const { fork, side } = T.SYMBOLS.unicode;
    if (track.parent)
        console.log(`${fork} fork of #${track.parent.bubble} "${track.parent.title}" in ${track.parent.track}`);
    if (track.origin)
        console.log(`${side} diverged from #${track.origin.bubble} "${track.origin.title}" in ${track.origin.track}`);
    console.log('');
    console.log(T.list(track, opts));
    if (track.handoff && track.handoff.note) {
        console.log('');
        console.log(`✎ handoff (${track.handoff.at}): ${track.handoff.note}`);
    }
    const active = T.activeBubble(track);
    if (active && active.state === 'fog') {
        console.log('');
        console.log(`⚠ "${active.title}" is fog — the human plans it. Ask them to classify it (${T.TYPES.join(', ')}) and fill it.`);
        return 3;
    }
    return 0;
}
