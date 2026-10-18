// Fog gate — pre-tool hook shared by Claude Code (PreToolUse), Codex CLI (PreToolUse/apply_patch)
// and Gemini CLI (BeforeTool). Blocks file edits while the active bubble is fog.
// Exit 2 + stderr = block (all three agents). Fails open on any internal error. Never writes stdout.

import T = require('./lib');
import { readStdinJson, resolveRoot, extractTargetPaths, isInsideBubblesDir } from './lib/io';

async function main(): Promise<number> {
  const input = await readStdinJson();
  const root = resolveRoot(input);
  const found = T.findTrack(root);
  if (!found || !found.track || found.track.closed) return 0; // a closed track is an archive: it gates nothing

  const targets = extractTargetPaths(input, root);
  // Editing the plan itself is always allowed — that's how fog gets filled.
  if (targets.length && targets.every((f) => isInsideBubblesDir(f, found.file))) return 0;

  const active = T.activeBubble(found.track);
  if (!active || active.state !== 'fog') return 0;

  process.stderr.write(
    `Active bubble "${active.title}" is unplanned — plan it with the user first (bubble fill). ` +
      `Do not plan fog yourself: ask the human to classify it (${T.TYPES.join(', ')}) and give the content.\n`
  );
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch(() => process.exit(0));
