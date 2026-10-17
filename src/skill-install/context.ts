// What every agent adapter gets: the install base, the options, a writer, and the installed skill.

import fs = require('node:fs');
import path = require('node:path');
import type { InstallOpts } from './args';
import { SKILL_SRC, log, createWriter, type Writer } from './io';

export interface Ctx {
  base: string;
  user: boolean;
  applyStatusline: boolean;
  write: Writer;
  /** Copy the self-contained skill folder into <base>/.agents (once per run); returns its installed dir. */
  installSkill(): string;
}

export const scriptsOf = (skillDir: string) => ({
  cli: path.join(skillDir, 'scripts', 'bubble.js'),
  gate: path.join(skillDir, 'scripts', 'fog-gate.js'),
  statusline: path.join(skillDir, 'scripts', 'statusline.js'),
  skillMd: path.join(skillDir, 'SKILL.md'),
});

export function createCtx(opts: InstallOpts, base: string): Ctx {
  const write = createWriter(!!opts.dryRun);
  const dest = path.join(base, '.agents', 'skills', 'bubble');
  let copied = path.resolve(dest) === path.resolve(SKILL_SRC);
  const installSkill = (): string => {
    if (copied) return dest;
    copied = true;
    if (write.dryRun) {
      log(`  ~ would copy skill -> ${dest}`);
      return dest;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(SKILL_SRC, dest, { recursive: true });
    log(`  + skill      ${dest}`);
    return dest;
  };
  return { base, user: !!opts.user, applyStatusline: !!opts.applyStatusline, write, installSkill };
}
