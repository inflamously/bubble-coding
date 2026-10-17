"use strict";
// Where tracks live: find, name, load and save them.
// Layout: .bubbles/<name>.json per track, .bubbles/current names the active one.
// No `current` file = the default track, .bubbles/track.json (name "track").
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackPath = exports.DEFAULT_NAME = exports.TRACK_DIR = void 0;
exports.findBubblesDir = findBubblesDir;
exports.checkName = checkName;
exports.currentName = currentName;
exports.setCurrent = setCurrent;
exports.listTracks = listTracks;
exports.loadTrack = loadTrack;
exports.findTrack = findTrack;
exports.saveTrack = saveTrack;
const fs = require("node:fs");
const path = require("node:path");
exports.TRACK_DIR = '.bubbles';
const CURRENT_FILE = 'current';
exports.DEFAULT_NAME = 'track';
const NAME_RE = /^[A-Za-z0-9_-]+$/;
/** Walk up from `dir` looking for a .bubbles directory. */
function findBubblesDir(dir) {
    let current = path.resolve(dir || '.');
    for (;;) {
        const candidate = path.join(current, exports.TRACK_DIR);
        try {
            if (fs.statSync(candidate).isDirectory())
                return candidate;
        }
        catch {
            /* keep walking */
        }
        const parent = path.dirname(current);
        if (parent === current)
            return null;
        current = parent;
    }
}
function checkName(name) {
    if (!name || !NAME_RE.test(name))
        throw new Error(`bad track name "${name || ''}" (letters, digits, - and _ only)`);
    return name;
}
const trackPath = (bubblesDir, name) => path.join(bubblesDir, `${name}.json`);
exports.trackPath = trackPath;
function currentName(bubblesDir) {
    try {
        const name = fs.readFileSync(path.join(bubblesDir, CURRENT_FILE), 'utf8').trim();
        if (NAME_RE.test(name))
            return name;
    }
    catch {
        /* no pointer: the default track */
    }
    return exports.DEFAULT_NAME;
}
function setCurrent(bubblesDir, name) {
    fs.mkdirSync(bubblesDir, { recursive: true });
    fs.writeFileSync(path.join(bubblesDir, CURRENT_FILE), checkName(name) + '\n', 'utf8');
}
/** Track names in a .bubbles dir, sorted. */
function listTracks(bubblesDir) {
    try {
        return fs
            .readdirSync(bubblesDir)
            .filter((f) => f.endsWith('.json') && NAME_RE.test(f.slice(0, -5)))
            .map((f) => f.slice(0, -5))
            .sort();
    }
    catch {
        return [];
    }
}
function loadTrack(file) {
    const track = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!track || !Array.isArray(track.bubbles))
        throw new Error('missing "bubbles" array');
    return track;
}
/** Current track: null (none), { file, name, bubblesDir, error } (unreadable), or { file, name, bubblesDir, track }. */
function findTrack(dir) {
    const bubblesDir = findBubblesDir(dir);
    if (!bubblesDir)
        return null;
    const name = currentName(bubblesDir);
    const file = (0, exports.trackPath)(bubblesDir, name);
    if (!fs.existsSync(file))
        return null;
    try {
        return { file, name, bubblesDir, track: loadTrack(file) };
    }
    catch (err) {
        return { file, name, bubblesDir, error: err.message };
    }
}
/** Atomic write: temp file + rename. */
function saveTrack(file, track) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(track, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, file);
}
