"use strict";
// Installer I/O: repo paths, adapter templates, and writes that honour --dry-run.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_SRC = exports.REPO = void 0;
exports.log = log;
exports.slash = slash;
exports.nodeCmd = nodeCmd;
exports.readText = readText;
exports.template = template;
exports.createWriter = createWriter;
const fs = require("node:fs");
const path = require("node:path");
/** This compiles to install/io.js, one level below the repo root. */
exports.REPO = path.join(__dirname, '..');
exports.SKILL_SRC = path.join(exports.REPO, 'skills', 'bubble');
const ADAPTERS = path.join(exports.REPO, 'adapters');
function log(msg) {
    console.log(msg);
}
/** Forward slashes work for node on Windows too, and avoid escaping trouble in JSON/TOML/shell. */
function slash(p) {
    return p.split(path.sep).join('/');
}
function nodeCmd(script) {
    return `node "${slash(script)}"`;
}
/** The file's text, or null if it doesn't exist. */
function readText(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
/** An adapters/ file with every {{KEY}} replaced. */
function template(name, vars) {
    return fs.readFileSync(path.join(ADAPTERS, name), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m);
}
function createWriter(dryRun) {
    function file(target, content) {
        const old = readText(target);
        if (old === content)
            return log(`  = unchanged  ${target}`);
        if (dryRun)
            return log(`  ~ would write ${target}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (old !== null)
            fs.writeFileSync(`${target}.bak`, old, 'utf8');
        fs.writeFileSync(target, content, 'utf8');
        log(old === null ? `  + created  ${target}` : `  ~ updated  ${target} (backup: .bak)`);
    }
    return { dryRun, file, json: (f, obj) => file(f, JSON.stringify(obj, null, 2) + '\n') };
}
