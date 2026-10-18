"use strict";
// Fork completion: a forked bubble waits for its child, and a finished child pops it, on up the chain.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFinished = void 0;
exports.checkForkFinished = checkForkFinished;
exports.popFinishedParents = popFinishedParents;
const fs = require("node:fs");
const path = require("node:path");
const store_1 = require("../store");
const follow_1 = require("./follow");
/** A track is finished when it's closed, or has bubbles and all are done (an empty, unsketched track isn't). */
const isFinished = (track) => !!track.closed || (track.bubbles.length > 0 && track.bubbles.every((b) => b.state === 'done'));
exports.isFinished = isFinished;
/** Throw if `bubble` has a fork that isn't finished yet; a missing child file needs `force`. */
function checkForkFinished(file, bubble, { force = false } = {}) {
    if (!bubble.fork)
        return;
    const childFile = (0, follow_1.linked)(file, bubble.fork);
    if (!fs.existsSync(childFile)) {
        if (force)
            return;
        throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork}, which is missing — re-run with --force to pop it anyway`);
    }
    if (!(0, exports.isFinished)((0, store_1.loadTrack)(childFile))) {
        throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork} — finish that track first (switch to it)`);
    }
}
/** Child finished (or closed) -> pop its parent bubble, and so on up the chain. Returns one message per popped parent. */
function popFinishedParents(childFile, child) {
    const msgs = [];
    for (let file = childFile, track = child; (0, exports.isFinished)(track);) {
        const p = (0, follow_1.parentOf)(file, track);
        if (!p || p.bubble.state === 'done')
            break;
        p.bubble.state = 'done';
        (0, store_1.saveTrack)(p.file, p.track);
        msgs.push(`fork finished — popped "${p.bubble.title}" in ${path.relative(path.dirname(childFile), p.file).split(path.sep).join('/')}`);
        file = p.file;
        track = p.track;
    }
    return msgs;
}
