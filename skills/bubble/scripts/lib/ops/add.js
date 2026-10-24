// Add a todo or fog bubble, at the end or at a position (insert).
import { ensureId } from '../model.js';
/** `why` (fog only) is the one-line reason the fog exists; without it the message asks for one. */
export function add(track, title, { fog = false, at, why } = {}) {
    const bubbles = track.bubbles;
    const bubble = fog ? { title: title || '???', state: 'fog' } : { title: title || '', state: 'todo' };
    if (!bubble.title)
        throw new Error('add needs a title');
    if (fog && why)
        bubble.why = why;
    if (at !== undefined) {
        const pos = Number(at) - 1;
        if (!Number.isInteger(pos) || pos < 0 || pos > bubbles.length)
            throw new Error(`bad position "${at}"`);
        bubbles.splice(pos, 0, bubble);
    }
    else {
        bubbles.push(bubble);
    }
    ensureId(track, bubble);
    if (!fog)
        return `added bubble "${bubble.title}"`;
    const n = bubbles.indexOf(bubble) + 1;
    return `added fog "${bubble.title}"` + (why ? ` — why: ${why}` : ` — no reason yet, say why it's unclear: why ${n} <text>`);
}
