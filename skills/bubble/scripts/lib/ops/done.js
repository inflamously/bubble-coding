"use strict";
// Pop the active bubble.
Object.defineProperty(exports, "__esModule", { value: true });
exports.done = done;
const model_1 = require("../model");
/** Mark the active bubble done. */
function done(track) {
    const i = (0, model_1.activeIndex)(track);
    if (i === -1)
        throw new Error('all bubbles are already done');
    const b = track.bubbles[i];
    if (b.state === 'fog')
        throw new Error(`"${b.title}" is fog — plan it with the human first`);
    b.state = 'done';
    return `popped "${b.title}"`;
}
