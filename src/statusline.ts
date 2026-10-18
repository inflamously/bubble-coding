// Claude Code status line: renders the bubble track for the current workspace.
// settings.json: { "statusLine": { "type": "command", "command": "node \"<abs>/statusline.js\"" } }

import T = require('./lib');
import { readStdinJson, resolveRoot } from './lib/io';

async function main(): Promise<string> {
  const input = await readStdinJson();
  const found = T.findTrack(resolveRoot(input));
  if (!found) return '';
  if (!found.track) return `bubbles: invalid ${found.name}.json`;
  return T.render(found.track, {
    ascii: process.argv.includes('--ascii') ? true : undefined,
    color: !process.argv.includes('--no-color'),
  });
}

main()
  .then((line) => process.stdout.write(line + '\n'))
  .catch(() => process.stdout.write('\n'));
