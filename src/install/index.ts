// Bubble Planner installer — wires the portable skill into each agent.
// Arguments live in args, shared I/O in io, and one adapter per agent in agents/.

import os = require('node:os');
import path = require('node:path');
import { HELP, parseArgs, type Agent } from './args';
import { createCtx, type Ctx } from './context';
import { log } from './io';
import { claude } from './agents/claude';
import { codex } from './agents/codex';
import { gemini } from './agents/gemini';
import { agentsMd } from './agents/agents-md';

const ADAPTERS: Record<Agent, (ctx: Ctx) => void> = { claude, codex, gemini, 'agents-md': agentsMd };

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.agents.length) return log(HELP);
  if (opts.user && opts.project) throw new Error('use either --user or --project, not both');
  const base = opts.user ? os.homedir() : path.resolve(opts.project || process.cwd());
  log(`Bubble Planner -> ${opts.user ? 'user' : 'project'}: ${base}${opts.dryRun ? '  (dry run)' : ''}`);

  const ctx = createCtx(opts, base);
  for (const agent of opts.agents) ADAPTERS[agent](ctx);
  log('\nDone. Start a track with:  node "<skill>/scripts/bubble.js" init "<title>"  (or ask the agent: /bubble)');
}

try {
  main();
} catch (err) {
  console.error(`install: ${(err as Error).message}`);
  process.exitCode = 1;
}
