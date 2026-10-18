"use strict";
// The note a fresh chat reads to resume the track.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setHandoff = setHandoff;
/** Save (or clear with "-") the note a fresh chat reads to pick this track back up. */
function setHandoff(track, note, now = new Date()) {
    if (!note)
        throw new Error('handoff needs a note (or - to clear it)');
    if (note === '-') {
        delete track.handoff;
        return 'cleared the handoff note';
    }
    track.handoff = { note, at: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
    return 'saved the handoff note';
}
