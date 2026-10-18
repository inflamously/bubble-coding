"use strict";
// What every agent adapter gets: the install base, the options, a writer, and the installed skill.
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptsOf = void 0;
exports.createCtx = createCtx;
const fs = require("node:fs");
const path = require("node:path");
const io_1 = require("./io");
const scriptsOf = (skillDir) => ({
    cli: path.join(skillDir, 'scripts', 'cli', 'bubble.js'),
    gate: path.join(skillDir, 'scripts', 'cli', 'fog-gate.js'),
    statusline: path.join(skillDir, 'scripts', 'cli', 'statusline.js'),
    skillMd: path.join(skillDir, 'SKILL.md'),
});
exports.scriptsOf = scriptsOf;
function createCtx(opts, base) {
    const write = (0, io_1.createWriter)(!!opts.dryRun);
    const dest = path.join(base, '.agents', 'skills', 'bubble');
    let copied = path.resolve(dest) === path.resolve(io_1.SKILL_SRC);
    const installSkill = () => {
        if (copied)
            return dest;
        copied = true;
        if (write.dryRun) {
            (0, io_1.log)(`  ~ would copy skill -> ${dest}`);
            return dest;
        }
        fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(io_1.SKILL_SRC, dest, { recursive: true });
        (0, io_1.log)(`  + skill      ${dest}`);
        return dest;
    };
    return { base, user: !!opts.user, applyStatusline: !!opts.applyStatusline, write, installSkill };
}
