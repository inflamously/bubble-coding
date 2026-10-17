"use strict";
// Codex CLI: the skill in .agents/skills plus a PreToolUse fog-gate hook in .codex/hooks.json.
Object.defineProperty(exports, "__esModule", { value: true });
exports.codex = codex;
const path = require("node:path");
const context_1 = require("../context");
const io_1 = require("../io");
const settings_1 = require("../settings");
function codex(ctx) {
    (0, io_1.log)('\n[codex] Codex CLI');
    const { gate } = (0, context_1.scriptsOf)(ctx.installSkill());
    const file = path.join(ctx.base, '.codex', 'hooks.json');
    const settings = (0, settings_1.upsertHook)((0, settings_1.readSettings)(file), 'PreToolUse', {
        matcher: 'apply_patch|Edit|Write',
        hooks: [{ type: 'command', command: (0, io_1.nodeCmd)(gate), timeout: 10, statusMessage: 'bubble fog gate' }],
    });
    ctx.write.json(file, settings);
    (0, io_1.log)(`  Use it with: $bubble   (Codex will ask you to trust the hook the first time it sees it)`);
}
