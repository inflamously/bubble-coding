"use strict";
// Bubble Planner installer — wires the portable skill into each agent.
// Arguments live in args, shared I/O in io, and one adapter per agent in agents/.
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("node:os");
const path = require("node:path");
const args_1 = require("./args");
const context_1 = require("./context");
const io_1 = require("./io");
const claude_1 = require("./agents/claude");
const codex_1 = require("./agents/codex");
const gemini_1 = require("./agents/gemini");
const agents_md_1 = require("./agents/agents-md");
const ADAPTERS = { claude: claude_1.claude, codex: codex_1.codex, gemini: gemini_1.gemini, 'agents-md': agents_md_1.agentsMd };
function main() {
    const opts = (0, args_1.parseArgs)(process.argv.slice(2));
    if (opts.help || !opts.agents.length)
        return (0, io_1.log)(args_1.HELP);
    if (opts.user && opts.project)
        throw new Error('use either --user or --project, not both');
    const base = opts.user ? os.homedir() : path.resolve(opts.project || process.cwd());
    (0, io_1.log)(`Bubble Planner -> ${opts.user ? 'user' : 'project'}: ${base}${opts.dryRun ? '  (dry run)' : ''}`);
    const ctx = (0, context_1.createCtx)(opts, base);
    for (const agent of opts.agents)
        ADAPTERS[agent](ctx);
    (0, io_1.log)('\nDone. Start a track with:  node "<skill>/scripts/bubble.js" init "<title>"  (or ask the agent: /bubble)');
}
try {
    main();
}
catch (err) {
    console.error(`install: ${err.message}`);
    process.exitCode = 1;
}
