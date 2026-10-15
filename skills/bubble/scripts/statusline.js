"use strict";
// Claude Code status line: renders the bubble track for the current workspace.
// settings.json: { "statusLine": { "type": "command", "command": "node \"<abs>/statusline.js\"" } }
Object.defineProperty(exports, "__esModule", { value: true });
const T = require("./lib/track");
const io_1 = require("./lib/io");
async function main() {
    const input = await (0, io_1.readStdinJson)();
    const found = T.findTrack((0, io_1.resolveRoot)(input));
    if (!found)
        return '';
    if (!found.track)
        return `bubbles: invalid ${found.name}.json`;
    return T.render(found.track, {
        ascii: process.argv.includes('--ascii') ? true : undefined,
        color: !process.argv.includes('--no-color'),
    });
}
main()
    .then((line) => process.stdout.write(line + '\n'))
    .catch(() => process.stdout.write('\n'));
