"use strict";
// Claude Code installs as a plugin; the installer only prints how, and optionally sets the status line.
Object.defineProperty(exports, "__esModule", { value: true });
exports.claude = claude;
const os = require("node:os");
const path = require("node:path");
const context_1 = require("../context");
const io_1 = require("../io");
const settings_1 = require("../settings");
function claude(ctx) {
    (0, io_1.log)('\n[claude] Claude Code plugin');
    const statusLine = { type: 'command', command: (0, io_1.nodeCmd)((0, context_1.scriptsOf)(io_1.SKILL_SRC).statusline), padding: 0 };
    (0, io_1.log)(`  Plugin (skill /bubble + fog-gate hook) — inside Claude Code run:`);
    (0, io_1.log)(`    /plugin marketplace add ${(0, io_1.slash)(io_1.REPO)}`);
    (0, io_1.log)(`    /plugin install bubble-coding@bubble-coding`);
    (0, io_1.log)(`  or for development:  claude --plugin-dir "${(0, io_1.slash)(io_1.REPO)}"`);
    if (!ctx.applyStatusline) {
        (0, io_1.log)(`  Status line (plugins can't set it) — add to ~/.claude/settings.json, or rerun with --apply-statusline:`);
        (0, io_1.log)(`    "statusLine": ${JSON.stringify(statusLine)}`);
        return;
    }
    const file = path.join(os.homedir(), '.claude', 'settings.json');
    const settings = (0, settings_1.readSettings)(file);
    if (settings.statusLine && !String(settings.statusLine.command || '').includes('statusline.js')) {
        (0, io_1.log)(`  ! replacing existing statusLine: ${JSON.stringify(settings.statusLine)}`);
    }
    settings.statusLine = statusLine;
    ctx.write.json(file, settings);
}
