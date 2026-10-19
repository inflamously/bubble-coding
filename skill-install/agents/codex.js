// Codex CLI: the skill in .agents/skills plus a PreToolUse fog-gate hook in .codex/hooks.json.
import * as path from 'node:path';
import { scriptsOf } from '../context.js';
import { log, nodeCmd } from '../io.js';
import { readSettings, upsertHook } from '../settings.js';
export function codex(ctx) {
    log('\n[codex] Codex CLI');
    const { gate } = scriptsOf(ctx.installSkill());
    const file = path.join(ctx.base, '.codex', 'hooks.json');
    const settings = upsertHook(readSettings(file), 'PreToolUse', {
        matcher: 'apply_patch|Edit|Write',
        hooks: [{ type: 'command', command: nodeCmd(gate), timeout: 10, statusMessage: 'bubble fog gate' }],
    });
    ctx.write.json(file, settings);
    log(`  Use it with: $bubble   (Codex will ask you to trust the hook the first time it sees it)`);
}
