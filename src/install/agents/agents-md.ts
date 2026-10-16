// AGENTS.md: a marked block any AGENTS.md-aware agent reads. A soft gate: nothing blocks edits.

import path = require('node:path');
import { type Ctx, scriptsOf } from '../context';
import { log, readText, slash, template } from '../io';

/** Also matches blocks from before the plugin was renamed from bubble-planner. */
const BLOCK = /<!-- bubble-(?:coding|planner):start -->[\s\S]*?<!-- bubble-(?:coding|planner):end -->/;

export function agentsMd(ctx: Ctx): void {
  log('\n[agents-md] AGENTS.md (soft gate, any AGENTS.md-aware agent)');
  if (ctx.user) {
    log('  skipped: AGENTS.md is per repo — use --project <dir>');
    return;
  }
  const { cli, skillMd } = scriptsOf(ctx.installSkill());
  const rel = (p: string) => slash(path.relative(ctx.base, p));
  const block = template('agents-md.md', { CLI: rel(cli), SKILL: rel(skillMd) }).trim();
  const file = path.join(ctx.base, 'AGENTS.md');
  const old = readText(file) ?? '';
  const next = BLOCK.test(old) ? old.replace(BLOCK, () => block) : (old.trim() ? old.replace(/\s*$/, '\n\n') : '') + block + '\n';
  ctx.write.file(file, next);
}
