// Claude Code installs as a plugin; the installer only prints how, and optionally sets the status line.
import * as os from 'node:os';
import * as path from 'node:path';
import { scriptsOf } from '../context.js';
import { REPO, SKILL_SRC, log, nodeCmd, slash } from '../io.js';
import { readSettings } from '../settings.js';
export function claude(ctx) {
    log('\n[claude] Claude Code plugin');
    const statusLine = { type: 'command', command: nodeCmd(scriptsOf(SKILL_SRC).statusline), padding: 0 };
    log(`  Plugin (skill /bubble + fog-gate hook) — inside Claude Code run:`);
    log(`    /plugin marketplace add ${slash(REPO)}`);
    log(`    /plugin install bubble-tracks@bubble-tracks`);
    log(`  or for development:  claude --plugin-dir "${slash(REPO)}"`);
    if (!ctx.applyStatusline) {
        log(`  Status line (plugins can't set it) — add to ~/.claude/settings.json, or rerun with --apply-statusline:`);
        log(`    "statusLine": ${JSON.stringify(statusLine)}`);
        return;
    }
    const file = path.join(os.homedir(), '.claude', 'settings.json');
    const settings = readSettings(file);
    if (settings.statusLine && !String(settings.statusLine.command || '').includes('statusline.js')) {
        log(`  ! replacing existing statusLine: ${JSON.stringify(settings.statusLine)}`);
    }
    settings.statusLine = statusLine;
    ctx.write.json(file, settings);
}
