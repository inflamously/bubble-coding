// What every agent adapter gets: the install base, the options, a writer, and the installed skill.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SKILL_SRC, log, createWriter } from './io.js';
export const scriptsOf = (skillDir) => ({
    cli: path.join(skillDir, 'scripts', 'cli', 'bubble.js'),
    gate: path.join(skillDir, 'scripts', 'cli', 'fog-gate.js'),
    statusline: path.join(skillDir, 'scripts', 'cli', 'statusline.js'),
    skillMd: path.join(skillDir, 'SKILL.md'),
});
export function createCtx(opts, base) {
    const write = createWriter(!!opts.dryRun);
    const dest = path.join(base, '.agents', 'skills', 'bubble');
    let copied = path.resolve(dest) === path.resolve(SKILL_SRC);
    const installSkill = () => {
        if (copied)
            return dest;
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
