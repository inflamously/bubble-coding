// Codex CLI: the skill in .agents/skills plus a PreToolUse fog-gate hook in .codex/hooks.json.

import path = require('node:path');
import { type Ctx, scriptsOf } from '../context';
import { log, nodeCmd } from '../io';
import { readSettings, upsertHook } from '../settings';

export function codex(ctx: Ctx): void {
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
