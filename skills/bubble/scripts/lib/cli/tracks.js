"use strict";
// Track-level commands: which track is current (init, create, switch, tracks, close, delete, fork, diverge).
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTrackCommand = runTrackCommand;
const fs = require("node:fs");
const path = require("node:path");
const T = require("../track");
const args_1 = require("./args");
const print_1 = require("./print");
/** Run a track-level command; returns an exit code, or undefined if `cmd` isn't one. */
function runTrackCommand(cmd, args, { dir, opts, renderOpts }) {
    const bubblesDir = T.findBubblesDir(dir) || path.join(dir, T.TRACK_DIR);
    const create = (name, title) => {
        T.checkName(name);
        const file = T.trackPath(bubblesDir, name);
        const track = { title: title || name, bubbles: [] };
        T.saveTrack(file, track);
        T.setCurrent(bubblesDir, name);
        console.log(`created track "${name}" (${file})`);
        console.log('');
        (0, print_1.printTrack)(track, renderOpts);
        return 0;
    };
    switch (cmd) {
        case 'init': {
            const file = T.trackPath(bubblesDir, T.DEFAULT_NAME);
            if (fs.existsSync(file))
                throw new Error(`track already exists: ${file} — use: switch <name> for another track`);
            return create(T.DEFAULT_NAME, args.join(' ') || path.basename(dir));
        }
        case 'create': {
            const name = T.checkName(args.shift());
            if (fs.existsSync(T.trackPath(bubblesDir, name)))
                throw new Error(`track "${name}" already exists — use: switch ${name}`);
            return create(name, args.join(' '));
        }
        case 'switch': {
            let name = args.shift();
            if (!name) {
                // bare switch: resume the current (last switched-to) track, else the default one
                name = [T.currentName(bubblesDir), T.DEFAULT_NAME].find((n) => fs.existsSync(T.trackPath(bubblesDir, n)));
                if (!name)
                    throw new Error('no tracks yet — start one with: switch <name>');
            }
            T.checkName(name);
            const file = T.trackPath(bubblesDir, name);
            if (!fs.existsSync(file))
                return create(name, args.join(' '));
            const track = T.loadTrack(file);
            T.setCurrent(bubblesDir, name);
            console.log(`resumed track "${name}"`);
            console.log('');
            return (0, print_1.printTrack)(track, renderOpts);
        }
        case 'tracks': {
            const names = T.listTracks(bubblesDir);
            if (!names.length) {
                console.log('no tracks yet — start one with: switch <name>');
                return 0;
            }
            const current = T.currentName(bubblesDir);
            for (const name of names) {
                let line;
                try {
                    line = T.render(T.loadTrack(T.trackPath(bubblesDir, name)), renderOpts);
                }
                catch (err) {
                    line = `invalid: ${err.message}`;
                }
                console.log(`${name === current ? '→' : ' '} ${name.padEnd(16)} ${line}`);
            }
            return 0;
        }
        case 'fork':
        case 'diverge': {
            // fork: build on the bubble (child.parent, the bubble waits). diverge: a different direction (child.origin, nothing waits).
            const found = T.findTrack(dir);
            if (!found)
                throw new Error(`no current track to ${cmd} from — start one with: switch <name>`);
            if (!found.track)
                throw new Error(`invalid ${found.file}: ${found.error}`);
            const addr = (0, args_1.isAddr)(args[0]) ? args.shift() : undefined;
            const name = T.checkName(args.shift());
            const childFile = T.trackPath(bubblesDir, name);
            if (fs.existsSync(childFile))
                throw new Error(`track "${name}" already exists — pick another name`);
            // References are relative paths with forward slashes, so tracks survive a moved checkout and other OSes.
            const rel = (from, to) => path.relative(path.dirname(from), to).split(path.sep).join('/');
            const bubble = (cmd === 'fork' ? T.markFork : T.markDiverge)(found.track, addr, rel(found.file, childFile));
            const link = { track: rel(childFile, found.file), bubble: bubble.id, title: bubble.title };
            const child = { title: bubble.title, [cmd === 'fork' ? 'parent' : 'origin']: link, bubbles: [] };
            T.saveTrack(childFile, child);
            T.saveTrack(found.file, found.track);
            T.setCurrent(bubblesDir, name);
            const verb = cmd === 'fork' ? 'forked' : 'diverged from';
            console.log(`${verb} "${bubble.title}" into track "${name}" — a fresh track: ask the human what to do, sketch it, classify all fog`);
            console.log('');
            return (0, print_1.printTrack)(child, renderOpts);
        }
        case 'close': {
            const name = T.checkName(args.shift());
            const file = T.trackPath(bubblesDir, name);
            if (!fs.existsSync(file))
                throw new Error(`no track "${name}"`);
            const track = T.loadTrack(file);
            if (track.closed)
                throw new Error(`track "${name}" is already closed`);
            if (!opts.force)
                throw new Error(`closing "${name}" is permanent (read-only, no reopen) — confirm with the human, then re-run with --force`);
            track.closed = { at: new Date().toISOString() };
            T.saveTrack(file, track);
            console.log(`closed track "${name}" — read-only from now on; fork, diverge or switch to keep working`);
            console.log('');
            return (0, print_1.printTrack)(track, renderOpts);
        }
        case 'delete': {
            const name = T.checkName(args.shift());
            const file = T.trackPath(bubblesDir, name);
            if (!fs.existsSync(file))
                throw new Error(`no track "${name}"`);
            if (name === T.currentName(bubblesDir))
                throw new Error(`"${name}" is the current track — switch to another one first`);
            if (!opts.force)
                throw new Error(`deleting "${name}" can't be undone — confirm with the human, then re-run with --force`);
            fs.unlinkSync(file);
            console.log(`deleted track "${name}"`);
            return 0;
        }
        default:
            return undefined;
    }
}
