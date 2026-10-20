// Abilities: skill-like workflows a human applies to the active bubble or track with /bubble:<name>.
// Layout: <name>.md in .bubble-tracks/abilities/ (project) and ~/.bubble-tracks/abilities/ (user);
// the project one wins on a name clash. Each file: a --- frontmatter block (name, description,
// type: bubble | track), then a free-text body, the workflow the agent runs once.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { findBubblesDir, TRACK_DIR } from './store.js';
export const ABILITY_DIR = 'abilities';
export const ABILITY_TYPES = ['bubble', 'track'];
const NAME_RE = /^[A-Za-z0-9_-]+$/;
// Where abilities live.
/** The ability folders, lowest precedence first: the user's, then the project's. */
export function abilityDirs(dir) {
    // process.env rather than node:os, so the demo's sandbox (node:fs and node:path only) can run it.
    const home = process.env.HOME || process.env.USERPROFILE;
    const bubblesDir = findBubblesDir(dir);
    const dirs = [home && path.join(home, TRACK_DIR, ABILITY_DIR), bubblesDir && path.join(bubblesDir, ABILITY_DIR)];
    return [...new Set(dirs.filter((d) => !!d))];
}
// Reading one file.
/** `key: value` lines into a record; split at the first colon, lines without one are skipped. */
function readMeta(lines) {
    const meta = {};
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon > 0)
            meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    return meta;
}
/** The --- frontmatter block and the body below it; throws when there is no block. */
function splitFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (lines[0].trim() !== '---' || end < 0)
        throw new Error('missing --- frontmatter (name, description, type)');
    return { meta: readMeta(lines.slice(1, end)), body: lines.slice(end + 1).join('\n').trim() };
}
/** Parse an ability file's text; throws with the reason when it isn't one. */
export function parseAbility(text, file) {
    const { meta, body } = splitFrontmatter(text);
    const name = meta.name || path.basename(file, '.md');
    if (!NAME_RE.test(name))
        throw new Error(`bad ability name "${name}" (letters, digits, - and _ only)`);
    const type = meta.type;
    if (!ABILITY_TYPES.includes(type))
        throw new Error(`type must be ${ABILITY_TYPES.join(' or ')}, got "${meta.type || ''}"`);
    if (!body)
        throw new Error('empty body — write the workflow below the frontmatter');
    return { name, description: meta.description || '', type, body, file };
}
// All of them together.
/** The .md files in an ability folder, sorted, as full paths; none when the folder doesn't exist. */
function abilityFiles(folder) {
    if (!fs.existsSync(folder))
        return [];
    return fs.readdirSync(folder).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(folder, f));
}
/** Every ability visible from `dir`, by name, sorted; a project file hides a user file of the same name. */
export function listAbilities(dir) {
    const byName = new Map();
    for (const folder of abilityDirs(dir)) {
        for (const file of abilityFiles(folder)) {
            let entry;
            try {
                const ability = parseAbility(fs.readFileSync(file, 'utf8'), file);
                entry = { name: ability.name, file, ability };
            }
            catch (err) {
                entry = { name: path.basename(file, '.md'), file, problem: err.message };
            }
            byName.set(entry.name, entry);
        }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/** The ability `name`; throws when it is missing or broken. */
export function findAbility(dir, name) {
    const entries = listAbilities(dir);
    const entry = entries.find((e) => e.name === name);
    if (!entry) {
        const known = entries.map((e) => e.name);
        const where = abilityDirs(dir).join(', ');
        throw new Error(`no ability "${name}" (${known.length ? `abilities: ${known.join(', ')}` : `none yet — add <name>.md to ${where}`})`);
    }
    if (!entry.ability)
        throw new Error(`ability "${name}" is broken (${entry.file}): ${entry.problem}`);
    return entry.ability;
}
