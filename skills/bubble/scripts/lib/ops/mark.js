"use strict";
// Mark a bubble as the source of a fork or a side track (the links themselves are in ../links).
Object.defineProperty(exports, "__esModule", { value: true });
exports.markFork = markFork;
exports.markDiverge = markDiverge;
const model_1 = require("../model");
/** Link a bubble to the child track forked from it; its state stays as is. Returns the bubble (with its id). */
function markFork(track, addr, childRef) {
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    if (b.state === 'done')
        throw new Error(`"${b.title}" is done — nothing left to fork`);
    if (b.fork)
        throw new Error(`"${b.title}" is already forked to ${b.fork}`);
    const id = (0, model_1.ensureId)(track, b);
    b.fork = childRef;
    return Object.assign(b, { id });
}
/** Link a bubble to a side track that went a different direction from it. Any state; the bubble doesn't wait for it. */
function markDiverge(track, addr, childRef) {
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    const id = (0, model_1.ensureId)(track, b);
    b.sides = [...(b.sides || []), childRef];
    return Object.assign(b, { id });
}
