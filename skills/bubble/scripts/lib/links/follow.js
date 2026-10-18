"use strict";
// Following a link: where a relative link path points, and the parent bubble a fork came from.
Object.defineProperty(exports, "__esModule", { value: true });
exports.linked = void 0;
exports.parentOf = parentOf;
const fs = require("node:fs");
const path = require("node:path");
const store_1 = require("../store");
/** The file a link path points to; link paths are relative to the linking track file. */
const linked = (fromFile, rel) => path.resolve(path.dirname(fromFile), rel);
exports.linked = linked;
/** Load the parent track and the bubble a child was forked from, or null if the link is broken or the parent is closed. */
function parentOf(childFile, child) {
    if (!child.parent)
        return null;
    const file = (0, exports.linked)(childFile, child.parent.track);
    if (!fs.existsSync(file))
        return null;
    const track = (0, store_1.loadTrack)(file);
    if (track.closed)
        return null; // a closed parent is read-only: the child runs on, nothing flows back
    const bubble = track.bubbles.find((b) => b.id === child.parent.bubble);
    return bubble ? { file, track, bubble } : null;
}
