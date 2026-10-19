// bubble-tracks installer — wires the portable skill into each agent.
// Arguments live in args, shared I/O in io, and one adapter per agent in agents/.

import * as os from 'node:os';
import * as path from 'node:path';
import { HELP, parseArgs, type Agent } from './args.js';
import { createCtx, type Ctx } from './context.js';
import { log } from './io.js';
import { claude } from './agents/claude.js';
import { codex } from './agents/codex.js';
import { gemini } from './agents/gemini.js';
import { agentsMd } from './agents/agents-md.js';

const ADAPTERS: Record<Agent, (ctx: Ctx) => void> = { claude, codex, gemini, 'agents-md': agentsMd };

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.agents.length) return log(HELP);
  if (opts.user && opts.project) throw new Error('use either --user or --project, not both');
  const base = opts.user ? os.homedir() : path.resolve(opts.project || process.cwd());
  log(`bubble-tracks -> ${opts.user ? 'user' : 'project'}: ${base}${opts.dryRun ? '  (dry run)' : ''}`);

  const ctx = createCtx(opts, base);
  for (const agent of opts.agents) ADAPTERS[agent](ctx);
  log('\nDone. Start a track with:  node "<skill>/scripts/cli/bubble.js" init "<title>"  (or ask the agent: /bubble)');
}

try {
  main();
} catch (err) {
  console.error(`install: ${(err as Error).message}`);
  process.exitCode = 1;
}
