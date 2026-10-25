// Linked tracks that hold a bubble: while its fork or side track is open, remove and fog refuse it.
import * as fs from 'node:fs';
import { loadTrack } from '../store.js';
import { linked } from './follow.js';
/** A linked track is open while its file exists and it isn't closed; an unreadable one counts as open. */
function isOpen(file, rel) {
    const childFile = linked(file, rel);
    if (!fs.existsSync(childFile))
        return false;
    try {
        return !loadTrack(childFile).closed;
    }
    catch {
        return true;
    }
}
/** Throw if any of `bubbles` has an open fork (or, with `sides`, an open side track); lists them per bubble. */
export function checkLinksClosed(file, bubbles, { sides = false } = {}) {
    const held = bubbles
        .map((b) => ({ b, open: [b.fork, ...(sides ? (b.sides ?? []) : [])].filter((rel) => !!rel && isOpen(file, rel)) }))
        .filter(({ open }) => open.length);
    if (!held.length)
        return;
    const what = sides ? 'fork or side track' : 'fork';
    throw new Error(held.map(({ b, open }) => `"${b.title}" has an open ${what}: ${open.join(', ')}`).join('; ') +
        ' — close or delete it first');
}
