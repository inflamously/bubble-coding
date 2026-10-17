"use strict";
// Gemini CLI: the skill, a BeforeTool fog-gate hook in .gemini/settings.json, and a /bubble command.
Object.defineProperty(exports, "__esModule", { value: true });
exports.gemini = gemini;
const path = require("node:path");
const context_1 = require("../context");
const io_1 = require("../io");
const settings_1 = require("../settings");
function gemini(ctx) {
    (0, io_1.log)('\n[gemini] Gemini CLI');
    const { gate, cli } = (0, context_1.scriptsOf)(ctx.installSkill());
    const file = path.join(ctx.base, '.gemini', 'settings.json');
    const settings = (0, settings_1.upsertHook)((0, settings_1.readSettings)(file), 'BeforeTool', {
        matcher: 'write_file|replace',
        hooks: [{ name: 'bubble-fog-gate', type: 'command', command: (0, io_1.nodeCmd)(gate), timeout: 10000 }],
    });
    ctx.write.json(file, settings);
    ctx.write.file(path.join(ctx.base, '.gemini', 'commands', 'bubble.toml'), (0, io_1.template)('gemini/bubble.toml', { CLI: (0, io_1.slash)(cli) }));
    (0, io_1.log)(`  Use it with: /bubble   (Gemini warns once before running a new hook)`);
}
