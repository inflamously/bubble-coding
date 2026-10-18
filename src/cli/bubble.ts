// bubble-tracks CLI — agent-neutral. Speaks the bubble domain language:
//   node bubble.js move 2 to 5   ·   node bubble.js "fog 4:8"   ·   node bubble.js bubble insert at 3 ?
// Parsing lives in lib/cli/args, track commands in lib/cli/tracks, bubble commands in lib/cli/bubbles.

import path = require('node:path');
import { HELP, parseArgs, type Ctx } from '../lib/cli/args';
import { runTrackCommand } from '../lib/cli/tracks';
import { runBubbleCommand } from '../lib/cli/bubbles';

function main(): number {
  const { cmd, args, opts } = parseArgs(process.argv.slice(2));
  if (!cmd || opts.help || cmd === 'help') {
    console.log(HELP);
    return 0;
  }
  // Color only for a human at a terminal (or BUBBLES_COLOR=1); agents reading the output get plain text.
  const color = process.env.BUBBLES_COLOR === '1' || (process.env.BUBBLES_COLOR !== '0' && !!process.stdout.isTTY);
  const ctx: Ctx = { dir: path.resolve(opts.dir || process.cwd()), opts, renderOpts: { ascii: opts.ascii ? true : undefined, color } };
  return runTrackCommand(cmd, args, ctx) ?? runBubbleCommand(cmd, args, ctx);
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`bubble: ${(err as Error).message}`);
  process.exitCode = 1;
}
