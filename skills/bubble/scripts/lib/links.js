"use strict";
// Fork links between tracks: a forked bubble waits for its child, and the child's changes flow back to it.
// Links are relative paths (from the linking track file) plus the parent bubble's stable id.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFinished = void 0;
exports.checkForkFinished = checkForkFinished;
exports.syncTitle = syncTitle;
exports.syncForkTitle = syncForkTitle;
exports.popFinishedParents = popFinishedParents;
exports.forkTree = forkTree;
const fs = require("node:fs");
const path = require("node:path");
const store_1 = require("./store");
const linked = (fromFile, rel) => path.resolve(path.dirname(fromFile), rel);
/** A track is finished when it's closed, or has bubbles and all are done (an empty, unsketched track isn't). */
const isFinished = (track) => !!track.closed || (track.bubbles.length > 0 && track.bubbles.every((b) => b.state === 'done'));
exports.isFinished = isFinished;
/** Throw if `bubble` has a fork that isn't finished yet; a missing child file needs `force`. */
function checkForkFinished(file, bubble, { force = false } = {}) {
    if (!bubble.fork)
        return;
    const childFile = linked(file, bubble.fork);
    if (!fs.existsSync(childFile)) {
        if (force)
            return;
        throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork}, which is missing — re-run with --force to pop it anyway`);
    }
    if (!(0, exports.isFinished)((0, store_1.loadTrack)(childFile))) {
        throw new Error(`"${bubble.title}" waits for its fork ${bubble.fork} — finish that track first (switch to it)`);
    }
}
/** Load the parent track and the bubble a child was forked from, or null if the link is broken or the parent is closed. */
function parentOf(childFile, child) {
    if (!child.parent)
        return null;
    const file = linked(childFile, child.parent.track);
    if (!fs.existsSync(file))
        return null;
    const track = (0, store_1.loadTrack)(file);
    if (track.closed)
        return null; // a closed parent is read-only: the child runs on, nothing flows back
    const bubble = track.bubbles.find((b) => b.id === child.parent.bubble);
    return bubble ? { file, track, bubble } : null;
}
/** Child retitled -> the parent bubble takes the new title. Returns a message, or ''. */
function syncTitle(childFile, child) {
    const p = parentOf(childFile, child);
    if (!p || !child.parent || !child.title || p.bubble.title === child.title)
        return '';
    p.bubble.title = child.title;
    child.parent.title = child.title;
    (0, store_1.saveTrack)(p.file, p.track);
    (0, store_1.saveTrack)(childFile, child);
    return `parent bubble #${p.bubble.id} in ${child.parent.track} renamed too`;
}
/** Parent bubble renamed -> its fork's title (and the child's copy of it) follow. Returns a message, or ''. */
function syncForkTitle(file, bubble) {
    if (!bubble.fork)
        return '';
    const childFile = linked(file, bubble.fork);
    if (!fs.existsSync(childFile))
        return '';
    const child = (0, store_1.loadTrack)(childFile);
    if (child.closed)
        return '';
    child.title = bubble.title;
    if (child.parent)
        child.parent.title = bubble.title;
    (0, store_1.saveTrack)(childFile, child);
    return `fork ${bubble.fork} renamed too`;
}
/** Child finished (or closed) -> pop its parent bubble, and so on up the chain. Returns one message per popped parent. */
function popFinishedParents(childFile, child) {
    const msgs = [];
    for (let file = childFile, track = child; (0, exports.isFinished)(track);) {
        const p = parentOf(file, track);
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
/** Every fork under `track`, forks of forks too, top down (a fork comes before its own forks). Side tracks aren't forks. */
function forkTree(file, track, seen = new Set([path.resolve(file)])) {
    const out = [];
    for (const b of track.bubbles) {
        if (!b.fork)
            continue;
        const childFile = linked(file, b.fork);
        if (seen.has(childFile))
            continue;
        seen.add(childFile);
        if (!fs.existsSync(childFile)) {
            out.push({ file: childFile, track: null, problem: 'missing, skipped' });
            continue;
        }
        try {
            const child = (0, store_1.loadTrack)(childFile);
            out.push({ file: childFile, track: child });
            out.push(...forkTree(childFile, child, seen));
        }
        catch (err) {
            out.push({ file: childFile, track: null, problem: `unreadable, skipped (${err.message})` });
        }
    }
    return out;
}
