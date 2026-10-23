// Claude Code status line: renders the bubble track for the current workspace.
// settings.json: { "statusLine": { "type": "command", "command": "node \"<abs>/statusline.js\"" } }

import * as lib from '../lib/index.js';
import { readStdinJson, resolveRoot } from '../lib/hooks/index.js';

async function main(): Promise<string> {
  const input = await readStdinJson();
  const found = lib.findTrack(resolveRoot(input));
  if (!found) return '';
  if (!found.track) return `bubbles: invalid ${found.name}.json`;
  const opts = {
    ascii: process.argv.includes('--ascii') ? true : undefined,
    color: !process.argv.includes('--no-color'),
  };
  return lib.render(found.track, opts) + lib.renderGuardCount(found.track, opts);
}

main()
  .then((line) => process.stdout.write(line + '\n'))
  .catch(() => process.stdout.write('\n'));
