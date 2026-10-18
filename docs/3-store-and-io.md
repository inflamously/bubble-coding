# 3. Store and IO

Three modules handle everything that touches the disk or another track:

| File | Job | Used by |
|---|---|---|
| `src/lib/store.ts` | find, name, load and save one track | everything |
| `src/lib/hooks/` | read a hook's stdin payload, work out the workspace, pull out target paths | `fog-gate.ts`, `statusline.ts` |
| `src/lib/links/` | follow fork links between tracks and push changes along them (`finish.ts`, `sync.ts`, `tree.ts`; `follow.ts` is shared) | `cli/*` |

## store.ts: where tracks live

```
.bubble-tracks/
├── current            ← one line: the name of the current track
├── src-tour.json      ← one Track per file (see 2-data-model.md)
└── src-changes.json
```

- **`findBubblesDir(dir)`** walks up from `dir` until it finds `.bubble-tracks/`, the way git looks for `.git/`. You can run the CLI from any subfolder.
- **`currentName`** reads `current`. If the file is missing or holds a bad name, it falls back to `track`, the default `track.json`.
- **`checkName`** only allows `[A-Za-z0-9_-]`. Since a track name becomes a filename, this also prevents path traversal.
- **`loadTrack`** is `JSON.parse` plus one check that a `bubbles` array exists. That's all the validation there is.
- **`findTrack(dir)`** returns one of three results: `null` (no tracks), `{ error }` (the file exists but is unreadable) or `{ track }`. The hooks rely on telling these apart.
- **`saveTrack`** writes a temp file and then renames it. Readers see either the old file or the new one, never half of each. It doesn't call fsync and doesn't take a lock.
- **`setCurrent`** is a plain `writeFileSync`, not a temp-file write followed by a rename.

## hooks/: talking to agent hooks

Claude Code, Codex CLI and Gemini CLI each send the hook a JSON payload on stdin. `hooks/input.ts` reads only the parts of it that the hooks need:

- **`readStdinJson`** returns `{}` for empty, invalid or TTY input. It never throws, so the hooks can fail open.
- **`resolveRoot`** looks for the workspace in this order: `workspace.project_dir` → `workspace.current_dir` → `cwd` → `$GEMINI_PROJECT_DIR` → `$CLAUDE_PROJECT_DIR` → `process.cwd()`. The process's own working directory comes last on purpose.
- **`extractTargetPaths`** collects the files an edit would touch:
  - Claude and Gemini put them in `file_path`, `path` or `notebook_path`.
  - Codex sends a raw `apply_patch` text, so the function scans it for `*** Add|Update|Delete File:` and `*** Move to:` lines.
- **`isInsideBubblesDir`** decides whether an edit only touches the plan. Editing the plan is always allowed, because that's how fog gets filled.

The gate only sees **file-editing tools**. A shell command that writes a file (for example `sed -i`) has no `file_path`, so the fog gate never checks it.

## links/: tracks pointing at tracks

A link is a path relative to the linking file, plus the stable `id` of the bubble it points to. `linked(fromFile, rel)` turns it back into an absolute path.

- **`isFinished`**: a track counts as finished if it's closed, or if it has at least one bubble and all of its bubbles are done. An empty track that was never sketched doesn't count as finished.
- **`checkForkFinished`** stops `done` on a bubble whose fork isn't finished. If the fork's file is missing, it needs `--force`.
- **The fork rules from the skill are carried out here:**
  - `syncTitle` (child retitled → the parent bubble's title follows)
  - `syncForkTitle` (parent bubble renamed → the child's title follows)
  - `popFinishedParents` (child finished → mark the parent bubble done, then repeat up the chain)

  All three skip a **closed** parent.
- **`linkLabel`** shows where a link points right now (`#3 "Title"`). If the target is gone, it falls back to the title stored in the link.
- **`forkTree`** collects every fork below a track, depth-first, and uses a `seen` set to protect against loops. `close` uses it to find every track it will close. Side tracks aren't forks, so they're never included.
- **A change that touches several tracks writes several files**, one `saveTrack` each. Each write is safe on its own, but a crash between two writes can leave one track updated and the other not.
