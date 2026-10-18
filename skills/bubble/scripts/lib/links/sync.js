"use strict";
// Title sync: a fork and the bubble it came from keep the same title, whichever side is renamed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTitle = syncTitle;
exports.syncForkTitle = syncForkTitle;
const fs = require("node:fs");
const store_1 = require("../store");
const follow_1 = require("./follow");
/** Child retitled -> the parent bubble takes the new title. Returns a message, or ''. */
function syncTitle(childFile, child) {
    const p = (0, follow_1.parentOf)(childFile, child);
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
    const childFile = (0, follow_1.linked)(file, bubble.fork);
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
