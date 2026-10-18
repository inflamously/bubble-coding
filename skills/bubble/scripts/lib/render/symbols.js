"use strict";
// What rendering is made of: the symbol sets (unicode / ascii), colors, and title shortening.
Object.defineProperty(exports, "__esModule", { value: true });
exports.paint = exports.SYMBOLS = void 0;
exports.useColor = useColor;
exports.symbolsFor = symbolsFor;
exports.symbolFor = symbolFor;
exports.shorten = shorten;
exports.SYMBOLS = {
    unicode: { done: '●', active: '◐', todo: '○', fog: '❓', sep: '──', prev: ' ‹ ', next: ' › ', more: '…', fork: '⑂', side: '↗', lock: '🔒' },
    ascii: { done: '*', active: '@', todo: 'o', fog: '?', sep: '--', prev: ' < ', next: ' > ', more: '...', fork: 'Y', side: '/', lock: '#' },
};
// ANSI colors: title dark green, track blue, prev ‹ active › next dark yellow.
const COLORS = { title: '\x1b[32m', track: '\x1b[34m', context: '\x1b[33m', reset: '\x1b[0m' };
const paint = (on, color, text) => on && text ? `${COLORS[color]}${text}${COLORS.reset}` : text;
exports.paint = paint;
/** Color is opt-in per call (opts.color); NO_COLOR always wins. */
function useColor(opts) {
    if (process.env.NO_COLOR)
        return false;
    return !!(opts && opts.color);
}
function symbolsFor(opts) {
    const ascii = opts && typeof opts.ascii === 'boolean' ? opts.ascii : process.env.BUBBLES_ASCII === '1';
    return ascii ? exports.SYMBOLS.ascii : exports.SYMBOLS.unicode;
}
function symbolFor(bubble, isActive, sym) {
    if (bubble.state === 'fog')
        return sym.fog;
    if (bubble.state === 'done')
        return sym.done;
    if (isActive || bubble.state === 'active')
        return sym.active;
    return sym.todo;
}
const LABEL_MAX = 20;
/** Cut a title to LABEL_MAX chars, at a word boundary when there is one. */
function shorten(title, sym) {
    const text = String(title || '').trim();
    if (text.length <= LABEL_MAX)
        return text;
    const room = LABEL_MAX - sym.more.length;
    const cut = text.slice(0, room + 1).lastIndexOf(' ');
    return text.slice(0, cut > room / 2 ? cut : room).trimEnd() + sym.more;
}
