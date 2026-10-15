"use strict";
// Shared I/O helpers for hooks and the status line.
Object.defineProperty(exports, "__esModule", { value: true });
exports.readStdinJson = readStdinJson;
exports.resolveRoot = resolveRoot;
exports.extractTargetPaths = extractTargetPaths;
exports.isInsideBubblesDir = isInsideBubblesDir;
const path = require("node:path");
/** Read all of stdin and parse JSON; {} on empty/invalid input. */
function readStdinJson() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY)
            return resolve({});
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => {
            try {
                resolve(data.trim() ? JSON.parse(data) : {});
            }
            catch {
                resolve({});
            }
        });
        process.stdin.on('error', () => resolve({}));
    });
}
/** Workspace dir from the agent's JSON payload (Claude / Codex / Gemini), never the process cwd first. */
function resolveRoot(input) {
    const ws = (input && input.workspace) || {};
    return (ws.project_dir ||
        ws.current_dir ||
        (input && input.cwd) ||
        process.env.GEMINI_PROJECT_DIR ||
        process.env.CLAUDE_PROJECT_DIR ||
        process.cwd());
}
/** Pull target file paths from a pre-tool payload (absolute, resolved against `root`). */
function extractTargetPaths(input, root) {
    const ti = (input && input.tool_input) || {};
    const found = [];
    for (const key of ['file_path', 'path', 'notebook_path']) {
        const val = ti[key];
        if (typeof val === 'string' && val)
            found.push(val);
    }
    // Codex apply_patch: raw patch text (in `command`, or `input`/`patch` in some versions).
    for (const key of ['command', 'input', 'patch']) {
        const raw = ti[key];
        const val = Array.isArray(raw) ? raw.join('\n') : raw;
        if (typeof val !== 'string')
            continue;
        const re = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;
        let m;
        while ((m = re.exec(val)))
            found.push((m[1] || m[2]).trim());
    }
    return found.map((p) => path.resolve(root, p));
}
/** True if `file` is inside `<trackRoot>/.bubbles`. */
function isInsideBubblesDir(file, trackFile) {
    const bubblesDir = path.dirname(trackFile);
    const rel = path.relative(bubblesDir, file);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
