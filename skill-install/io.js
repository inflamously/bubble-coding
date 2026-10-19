// Installer I/O: repo paths, adapter templates, and writes that honour --dry-run.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
/** This compiles to skill-install/io.js, one level below the repo root. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.join(__dirname, '..');
export const SKILL_SRC = path.join(REPO, 'skills', 'bubble');
const ADAPTERS = path.join(REPO, 'adapters');
export function log(msg) {
    console.log(msg);
}
/** Forward slashes work for node on Windows too, and avoid escaping trouble in JSON/TOML/shell. */
export function slash(p) {
    return p.split(path.sep).join('/');
}
export function nodeCmd(script) {
    return `node "${slash(script)}"`;
}
/** The file's text, or null if it doesn't exist. */
export function readText(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
/** An adapters/ file with every {{KEY}} replaced. */
export function template(name, vars) {
    return fs.readFileSync(path.join(ADAPTERS, name), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m);
}
export function createWriter(dryRun) {
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
