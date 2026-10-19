// Gemini CLI: the skill, a BeforeTool fog-gate hook in .gemini/settings.json, and a /bubble command.

import * as path from 'node:path';
import { type Ctx, scriptsOf } from '../context.js';
import { log, nodeCmd, slash, template } from '../io.js';
import { readSettings, upsertHook } from '../settings.js';

export function gemini(ctx: Ctx): void {
  log('\n[gemini] Gemini CLI');
  const { gate, cli } = scriptsOf(ctx.installSkill());
  const file = path.join(ctx.base, '.gemini', 'settings.json');
  const settings = upsertHook(readSettings(file), 'BeforeTool', {
    matcher: 'write_file|replace',
    hooks: [{ name: 'bubble-fog-gate', type: 'command', command: nodeCmd(gate), timeout: 10000 }],
  });
  ctx.write.json(file, settings);
  ctx.write.file(path.join(ctx.base, '.gemini', 'commands', 'bubble.toml'), template('gemini/bubble.toml', { CLI: slash(cli) }));
  log(`  Use it with: /bubble   (Gemini warns once before running a new hook)`);
}
