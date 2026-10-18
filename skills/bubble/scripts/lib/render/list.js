"use strict";
// The numbered listing that `show` prints.
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
const model_1 = require("../model");
const symbols_1 = require("./symbols");
/** Multi-line listing of the track, with addressable indexes. */
function list(track, opts) {
    const sym = (0, symbols_1.symbolsFor)(opts);
    const index = track.closed ? -1 : (0, model_1.activeIndex)(track);
    return (track.bubbles || [])
        .map((b, i) => {
        const mark = i === index ? '→' : ' ';
        const type = b.type ? ` [${b.type}]` : '';
        const fork = (b.fork ? ` ${sym.fork} ${b.fork}` : '') + (b.sides || []).map((s) => ` ${sym.side} ${s}`).join('');
        const hint = b.hint ? `\n        ↳ ${b.hint}` : '';
        return `${mark} ${String(i + 1).padEnd(3)} ${(0, symbols_1.symbolFor)(b, i === index, sym)} ${b.state.padEnd(6)} ${b.title}${type}${fork}${hint}`;
    })
        .join('\n');
}
