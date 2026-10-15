# Bubble Planner

Gamified planning for coding agents, with fog of war. A plan is a linear track of task bubbles:

```
Fix generation   S ●──●──❓──○ F   Read logs ‹ ❓ needs you › Write failing test
```

`●` done · `◐` active · `○` todo · `❓` fog (unplanned) · `prev ‹ active › next` tells you where you are

In the status line and in a terminal, the track title is green, the track is blue, and `prev ‹ active › next` is yellow. Set `NO_COLOR=1` (or pass `--no-color` to `statusline.js`) to turn colors off, or `BUBBLES_COLOR=1` to force them on.

- **Plan only as far as you can see.** Unclear steps stay fog until you reach them.
- **Known bubbles:** the agent implements them.
- **Fog bubbles:** the agent stops, and the human plans the bubble. The agent never plans fog on its own.
- **One line, as long as it needs.** If a fog bubble turns out to be several tasks, it becomes consecutive bubbles on the same line.

## What you get per agent

| Agent | `/bubble` | Hard fog gate (blocks edits) | Live status line |
|---|---|---|---|
| Claude Code | plugin skill `/bubble` | ✅ `PreToolUse` hook | ✅ |
| Codex CLI | skill `$bubble` | ✅ `PreToolUse` hook on `apply_patch` | ❌ use `bubble show` |
| Gemini CLI | `/bubble` command + skill | ✅ `BeforeTool` hook | ❌ use `bubble show` |
| Anything that reads AGENTS.md | instructions | soft (the model is told to stop) | ❌ use `bubble show` |

Everything portable lives in **`skills/bubble/`**: `SKILL.md` plus zero-dependency Node scripts (built from `src/`, committed). Requirements: Node ≥ 24 (the current LTS). It works on Windows, macOS, Linux and WSL, and scripts always run as `node "<path>"`.

## Install

### Claude Code

1. Install the plugin. Inside Claude Code, run:
   ```
   /plugin marketplace add inflamously/bubble-coding
   /plugin install bubble-planner@bubble-coding
   ```
   From a local checkout, use `/plugin marketplace add /path/to/bubble-coding`. For development, run `claude --plugin-dir /path/to/bubble-coding` instead.
2. Add the status line. Plugins can't set it, so either run `node install.js claude --apply-statusline`, or add this to `~/.claude/settings.json`:
   ```json
   "statusLine": { "type": "command", "command": "node \"/path/to/bubble-coding/skills/bubble/scripts/statusline.js\"" }
   ```

If the symbols render badly, set `"env": { "BUBBLES_ASCII": "1" }` in settings. The line then looks like `S *--@--?--o F`.

### Codex CLI, Gemini CLI and AGENTS.md

```
node install.js codex gemini agents-md --project /path/to/your/repo   # one repo
node install.js codex gemini --user                                   # all repos (~/.agents, ~/.codex, ~/.gemini)
node install.js all --project . --dry-run                             # preview only
```

What the installer does:
- Copies the skill to `.agents/skills/bubble/`, a folder both Codex and Gemini read.
- Merges the gate into `.codex/hooks.json` and `.gemini/settings.json`.
- Writes `.gemini/commands/bubble.toml`.
- Inserts a marked block into `AGENTS.md`.

It is idempotent and backs up any file it changes to `*.bak`. Codex and Gemini will ask you to trust the new hook the first time.

Hook paths are absolute. If you commit `.codex/` or `.gemini/` to a shared repo, teammates need to re-run the installer.

## The CLI

```
node skills/bubble/scripts/bubble.js <command> [--dir <repo>] [--ascii]

show                           render + list the bubbles (exit 3 = active bubble is fog)
switch [name] [title]          resume a track, or create it (no name: the current one)
create <name> [title]          create a new track (refuses if it exists)
tracks                         list tracks
delete <name> --force          delete a track (not the current one)
init <title>                   create the default track (.bubbles/track.json)
add <title> | add ?            append a todo (or fog) bubble
insert at N <title> | insert at N ?
remove N | remove N:M
move N to M | move N:M to M    block lands starting at position M
rename N <title>               retitle a planned bubble
title <text>                   rename the track itself
handoff <note> | handoff -     save (or clear) the note a fresh chat resumes from
hint N <text> | hint N -       attach (or clear) a note for that bubble
fog [N | N:M] [TYPE]           turn into fog (done bubbles need --force)
type [N] <TYPE>                known-known | known-unknown | unknown-known | unknown-unknown (kk/ku/uk/uu)
fill [N] <title>               fog -> todo, with the human's content (fog only)
done                           pop the active bubble, then ⏸ stop
```

`N` is the Nth bubble on the track (omitted = the active bubble). `N:M` is N through M, inclusive.

### Steering the track

The CLI speaks a small domain language, so the same line works three ways:

- **In chat:** `bubble move 2 to 3`. The agent runs it verbatim and shows the track.
- **As a command:** `/bubble insert at 3 ?` (Claude Code), `/bubble …` (Gemini CLI), `$bubble …` (Codex).
- **Directly, no agent:** `! node skills/bubble/scripts/bubble.js fog 4:8` in Claude Code. A leading `bubble` word is optional, and a whole phrase can be one quoted argument.

After every `done` the agent stops (⏸) and waits, so you can reshape the path before the next bubble starts.

## State

Tracks live in `.bubbles/`, one `.json` file per track, and `.bubbles/current` names the active one. Agents find `.bubbles/` by walking up from the directory they report. A repo with only `.bubbles/track.json` (no `current`) is a single track named `track`, so older repos keep working.

```
bubble switch idea-a       resume idea-a, or create it if it doesn't exist
bubble tracks              list tracks, current marked →
bubble delete idea-b --force
```

In a fresh chat, `/bubble switch idea-a` is enough to pick a track back up. Hints and the handoff note carry the context between chats. When a chat gets heavy, the agent offers to save a `bubble handoff <note>` (what's half done, the decisions made, the next step) and tells you to `/clear` and switch back. Every bubble command, the status line and the fog gate act on the current track.

A track file:

```json
{ "title": "Fix generation",
  "bubbles": [ { "title": "Repro", "state": "done" },
               { "title": "???", "state": "fog", "type": "unknown-unknown" },
               { "title": "Patch", "state": "todo" } ] }
```

The active bubble is the first one that isn't done.

## Fog types

When the agent reaches a fog bubble, the human classifies it:

| Type | Who does what |
|---|---|
| `known-known` | The human writes the bubble. |
| `known-unknown` | The agent researches or spikes options; the human picks. |
| `unknown-known` | The agent surfaces existing knowledge (codebase, docs); the human confirms. |
| `unknown-unknown` | The agent interviews the human, one question at a time. |

The MVP stores the type. The skill tells the agent how to behave for each type, but no code enforces it.

## Develop

The source is TypeScript in `src/`. It builds into `skills/bubble/scripts/`, and that JS is committed, because it's what the hooks, the status line and installed copies run. Users never need a build step or any dependency.

```
npm install     # dev only: typescript + @types/node
npm run build   # src/*.ts -> skills/bubble/scripts/*.js
npm test        # node --test; fails if the committed JS drifts from src/
```

Edit `src/`, never the generated JS, and commit both together.

Known limitation: the gate covers file-edit tools only. Writes made through shell commands (Bash, `run_shell_command`) aren't blocked.

## License

MIT, see [LICENSE](LICENSE).
