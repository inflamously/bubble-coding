"use strict";
// The one-line track: the status line and `tracks`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = render;
const model_1 = require("../model");
const symbols_1 = require("./symbols");
/** One-line render: `Title   S ●──●──◐──❓ F   prev ‹ ◐ active › next`, or `… F   🔒 closed` (nothing active). */
function render(track, opts) {
    const sym = (0, symbols_1.symbolsFor)(opts);
    const bubbles = track.bubbles || [];
    const index = track.closed ? -1 : (0, model_1.activeIndex)(track);
    const color = (0, symbols_1.useColor)(opts);
    const line = bubbles.map((b, i) => (0, symbols_1.symbolFor)(b, i === index, sym)).join(sym.sep);
    const head = `${(0, symbols_1.paint)(color, 'title', track.title || 'Plan')}   ${(0, symbols_1.paint)(color, 'track', `S ${line}${line ? ' ' : ''}F`)}   `;
    if (track.closed)
        return head + (0, symbols_1.paint)(color, 'context', `${sym.lock} closed`);
    const active = bubbles[index];
    if (!active)
        return head + (0, symbols_1.paint)(color, 'context', 'all done');
    const prev = bubbles[index - 1];
    const next = bubbles[index + 1];
    const here = active.state === 'fog' ? `${sym.fog} needs you` : `${sym.active} ${(0, symbols_1.shorten)(active.title, sym)}`;
    const context = (prev ? (0, symbols_1.shorten)(prev.title, sym) + sym.prev : '') + here + (next ? sym.next + (0, symbols_1.shorten)(next.title, sym) : '');
    return head + (0, symbols_1.paint)(color, 'context', context);
}
