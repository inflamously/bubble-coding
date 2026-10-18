"use strict";
// The human's note on a bubble.
Object.defineProperty(exports, "__esModule", { value: true });
exports.hint = hint;
const model_1 = require("../model");
/** Attach a note to a bubble; "-" or empty clears it. */
function hint(track, addr, text) {
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    if (!text || text === '-') {
        delete b.hint;
        return `cleared hint on "${b.title}"`;
    }
    b.hint = text;
    return `hint on "${b.title}": ${text}`;
}
