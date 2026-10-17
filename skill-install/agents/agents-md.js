"use strict";
// AGENTS.md: a marked block any AGENTS.md-aware agent reads. A soft gate: nothing blocks edits.
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentsMd = agentsMd;
const path = require("node:path");
const context_1 = require("../context");
const io_1 = require("../io");
/** Also matches blocks from before the plugin was renamed from bubble-planner. */
const BLOCK = /<!-- bubble-(?:coding|planner):start -->[\s\S]*?<!-- bubble-(?:coding|planner):end -->/;
function agentsMd(ctx) {
    (0, io_1.log)('\n[agents-md] AGENTS.md (soft gate, any AGENTS.md-aware agent)');
    if (ctx.user) {
        (0, io_1.log)('  skipped: AGENTS.md is per repo — use --project <dir>');
        return;
    }
    const { cli, skillMd } = (0, context_1.scriptsOf)(ctx.installSkill());
    const rel = (p) => (0, io_1.slash)(path.relative(ctx.base, p));
    const block = (0, io_1.template)('agents-md.md', { CLI: rel(cli), SKILL: rel(skillMd) }).trim();
    const file = path.join(ctx.base, 'AGENTS.md');
    const old = (0, io_1.readText)(file) ?? '';
    const next = BLOCK.test(old) ? old.replace(BLOCK, () => block) : (old.trim() ? old.replace(/\s*$/, '\n\n') : '') + block + '\n';
    ctx.write.file(file, next);
}
