"use strict";
// bubble-tracks CLI — agent-neutral. Speaks the bubble domain language:
//   node bubble.js move 2 to 5   ·   node bubble.js "fog 4:8"   ·   node bubble.js bubble insert at 3 ?
// Parsing lives in lib/cli/args, track commands in lib/cli/tracks, bubble commands in lib/cli/bubbles.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("node:path");
const args_1 = require("./lib/cli/args");
const tracks_1 = require("./lib/cli/tracks");
const bubbles_1 = require("./lib/cli/bubbles");
function main() {
    const { cmd, args, opts } = (0, args_1.parseArgs)(process.argv.slice(2));
    if (!cmd || opts.help || cmd === 'help') {
        console.log(args_1.HELP);
        return 0;
    }
    // Color only for a human at a terminal (or BUBBLES_COLOR=1); agents reading the output get plain text.
    const color = process.env.BUBBLES_COLOR === '1' || (process.env.BUBBLES_COLOR !== '0' && !!process.stdout.isTTY);
    const ctx = { dir: path.resolve(opts.dir || process.cwd()), opts, renderOpts: { ascii: opts.ascii ? true : undefined, color } };
    return (0, tracks_1.runTrackCommand)(cmd, args, ctx) ?? (0, bubbles_1.runBubbleCommand)(cmd, args, ctx);
}
try {
    process.exitCode = main();
}
catch (err) {
    console.error(`bubble: ${err.message}`);
    process.exitCode = 1;
}
