"use strict";
// Delete bubbles.
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = remove;
const model_1 = require("../model");
function remove(track, spec) {
    const [from, to] = (0, model_1.resolveRange)(track, spec);
    const gone = track.bubbles.splice(from, to - from + 1);
    return `removed ${gone.map((b) => `"${b.title}"`).join(', ')}`;
}
