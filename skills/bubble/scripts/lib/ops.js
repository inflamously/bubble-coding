"use strict";
// Track mutations: each changes the track in place and returns a short message for the CLI.
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
exports.fog = fog;
exports.setType = setType;
exports.fill = fill;
exports.rename = rename;
exports.hint = hint;
exports.remove = remove;
exports.move = move;
exports.moveTo = moveTo;
exports.setHandoff = setHandoff;
exports.setTitle = setTitle;
exports.markFork = markFork;
exports.markDiverge = markDiverge;
exports.done = done;
const model_1 = require("./model");
function add(track, title, { fog = false, at } = {}) {
    const bubbles = track.bubbles;
    const bubble = fog ? { title: title || '???', state: 'fog' } : { title: title || '', state: 'todo' };
    if (!bubble.title)
        throw new Error('add needs a title');
    if (at !== undefined) {
        const pos = Number(at) - 1;
        if (!Number.isInteger(pos) || pos < 0 || pos > bubbles.length)
            throw new Error(`bad position "${at}"`);
        bubbles.splice(pos, 0, bubble);
    }
    else {
        bubbles.push(bubble);
    }
    (0, model_1.ensureId)(track, bubble);
    return `added ${fog ? 'fog' : 'bubble'} "${bubble.title}"`;
}
/** Turn a bubble (or N:M range) into fog. Done bubbles need `force`. */
function fog(track, spec, type, { force = false } = {}) {
    type = (0, model_1.normalizeType)(type);
    (0, model_1.checkType)(type);
    const [from, to] = spec === undefined ? [(0, model_1.resolve)(track), (0, model_1.resolve)(track)] : (0, model_1.resolveRange)(track, spec);
    const picked = track.bubbles.slice(from, to + 1);
    const finished = picked.filter((b) => b.state === 'done');
    if (finished.length && !force) {
        throw new Error(`${finished.map((b) => `"${b.title}"`).join(', ')} ${finished.length > 1 ? 'are' : 'is'} done — ` +
            'confirm with the human, then re-run with --force');
    }
    for (const b of picked) {
        b.state = 'fog';
        if (type)
            b.type = type;
    }
    return picked.length === 1 ? `"${picked[0].title}" is now fog` : `bubbles ${from + 1}–${to + 1} are now fog`;
}
function setType(track, addr, type) {
    if (!type)
        throw new Error('type needs a value');
    type = (0, model_1.normalizeType)(type);
    (0, model_1.checkType)(type);
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    b.type = type;
    return `"${b.title}" classified as ${type}`;
}
/** Human-planned content for a fog bubble: fog -> todo. */
function fill(track, addr, title) {
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    if (b.state !== 'fog')
        throw new Error(`"${b.title}" isn't fog — use rename to change its title`);
    if (!title)
        throw new Error('fill needs a title');
    b.title = title;
    b.state = 'todo';
    return `filled "${b.title}"`;
}
function rename(track, addr, title) {
    const b = track.bubbles[(0, model_1.resolve)(track, addr)];
    if (b.state === 'fog')
        throw new Error(`"${b.title}" is fog — plan it with fill`);
    if (!title)
        throw new Error('rename needs a title');
    const old = b.title;
    b.title = title;
    return `renamed "${old}" → "${title}"`;
}
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
function remove(track, spec) {
    const [from, to] = (0, model_1.resolveRange)(track, spec);
    const gone = track.bubbles.splice(from, to - from + 1);
    return `removed ${gone.map((b) => `"${b.title}"`).join(', ')}`;
}
/** Move a bubble (or N:M block) so it starts at position `to` in the resulting track. */
function move(track, spec, to) {
    const [from, last] = (0, model_1.resolveRange)(track, spec);
    const block = track.bubbles.splice(from, last - from + 1);
    const pos = Number(to) - 1;
    if (!Number.isInteger(pos) || pos < 0 || pos > track.bubbles.length) {
        track.bubbles.splice(from, 0, ...block); // undo
        throw new Error(`bad position "${to}"`);
    }
    track.bubbles.splice(pos, 0, ...block);
    return `moved ${block.map((b) => `"${b.title}"`).join(', ')} to ${pos + 1}`;
}
/**
 * Move a bubble (or N:M block) to the end of another track, state, type and hint included. They get new ids
 * from `target`'s counter. Bubbles with a fork or side track are refused: those tracks link back here by id.
 */
function moveTo(track, spec, target, targetName) {
    const [from, last] = (0, model_1.resolveRange)(track, spec);
    const linked = track.bubbles.slice(from, last + 1).filter((b) => b.fork || b.sides?.length);
    if (linked.length) {
        throw new Error(`${linked.map((b) => `"${b.title}"`).join(', ')} ${linked.length > 1 ? 'have' : 'has'} a fork or side track ` +
            'linked to this track — it stays here');
    }
    const block = track.bubbles.splice(from, last - from + 1);
    for (const { title, state, id: _old, ...rest } of block) {
        const b = { title, state }; // the new id goes right after state, as on every other bubble
        (0, model_1.ensureId)(target, b);
        target.bubbles.push(Object.assign(b, rest));
    }
    return `moved ${block.map((b) => `"${b.title}"`).join(', ')} to track "${targetName}"`;
}
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
/** Rename the track itself. */
function setTitle(track, title) {
    if (!title)
        throw new Error('title needs text');
    const old = track.title;
    track.title = title;
    return `track "${old}" → "${title}"`;
}
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
/** Mark the active bubble done. */
function done(track) {
    const i = (0, model_1.activeIndex)(track);
    if (i === -1)
        throw new Error('all bubbles are already done');
    const b = track.bubbles[i];
    if (b.state === 'fog')
        throw new Error(`"${b.title}" is fog — plan it with the human first`);
    b.state = 'done';
    return `popped "${b.title}"`;
}
