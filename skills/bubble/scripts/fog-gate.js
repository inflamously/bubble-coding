"use strict";
// Fog gate — pre-tool hook shared by Claude Code (PreToolUse), Codex CLI (PreToolUse/apply_patch)
// and Gemini CLI (BeforeTool). Blocks file edits while the active bubble is fog.
// Exit 2 + stderr = block (all three agents). Fails open on any internal error. Never writes stdout.
Object.defineProperty(exports, "__esModule", { value: true });
const T = require("./lib/track");
const io_1 = require("./lib/io");
async function main() {
    const input = await (0, io_1.readStdinJson)();
    const root = (0, io_1.resolveRoot)(input);
    const found = T.findTrack(root);
    if (!found || !found.track)
        return 0;
    const targets = (0, io_1.extractTargetPaths)(input, root);
    // Editing the plan itself is always allowed — that's how fog gets filled.
    if (targets.length && targets.every((f) => (0, io_1.isInsideBubblesDir)(f, found.file)))
        return 0;
    const active = T.activeBubble(found.track);
    if (!active || active.state !== 'fog')
        return 0;
    process.stderr.write(`Active bubble "${active.title}" is unplanned — plan it with the user first (bubble fill). ` +
        `Do not plan fog yourself: ask the human to classify it (${T.TYPES.join(', ')}) and give the content.\n`);
    return 2;
}
main()
    .then((code) => process.exit(code))
    .catch(() => process.exit(0));
