// The bubble CLI as a function, so one process (node, via cli/bubble.ts) or many (the demo site's
// in-memory machine, once per command) can run it. It talks to the world only through
// node:fs, node:path, process and console.
import * as path from 'node:path';
import { HELP, parseArgs } from './args.js';
import { runTrackCommand } from './tracks.js';
import { runBubbleCommand } from './bubbles.js';
import { runAbilityCommand } from './abilities.js';
function main() {
    const { cmd, args, opts } = parseArgs(process.argv.slice(2));
    if (!cmd || opts.help || cmd === 'help') {
        console.log(HELP);
        return 0;
    }
    // Color only for a human at a terminal (or BUBBLES_COLOR=1); agents reading the output get plain text.
    const color = process.env.BUBBLES_COLOR === '1' || (process.env.BUBBLES_COLOR !== '0' && !!process.stdout.isTTY);
    const ctx = { dir: path.resolve(opts.dir || process.cwd()), opts, renderOpts: { ascii: opts.ascii ? true : undefined, color } };
    return runTrackCommand(cmd, args, ctx) ?? runAbilityCommand(cmd, args, ctx) ?? runBubbleCommand(cmd, args, ctx);
}
/** One `bubble …` invocation: reads process.argv, prints, and sets process.exitCode. */
export function run() {
    try {
        process.exitCode = main();
    }
    catch (err) {
        console.error(`bubble: ${err.message}`);
        process.exitCode = 1;
    }
}
