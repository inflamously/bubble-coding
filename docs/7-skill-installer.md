# 7. Skill installer

`node install.js <agent…>` wires the skill into a repo (or user-wide) for each agent. `install.js` at the repo root is a two-line shim that requires `skill-install/index.js`. That JS is compiled from `src/skill-install/` by its own tsconfig (`tsconfig.skill-install.json`, `outDir: skill-install`) and committed.

**Why a separate build:** `skills/bubble/` is the folder that gets *copied into* every target repo. The installer must not be inside it, or every repo would get a copy of the installer too.

| File | Job |
|---|---|
| `index.ts` | parse, pick the base dir, run one adapter per agent |
| `args.ts` | `HELP`, `parseArgs`, the `AGENTS` list |
| `context.ts` | `Ctx` given to every adapter: base dir, options, writer, `installSkill()`; `scriptsOf(dir)` paths |
| `io.ts` | repo paths, `{{KEY}}` templates from `adapters/`, the writer that honours `--dry-run` |
| `settings.ts` | read an agent's JSON settings, swap in the fog-gate hook |
| `agents/*.ts` | one adapter per agent: `claude`, `codex`, `gemini`, `agents-md` |

## The flow

```
node install.js codex gemini --project ../my-repo [--dry-run]
```

1. **`parseArgs`**: agent names (or `all`) plus `--project <dir>`, `--user`, `--apply-statusline`, `--dry-run`. Agents are de-duplicated. No agent → print help.
2. **Base dir**: `--user` → your home dir, otherwise `--project` or cwd. Both together is an error.
3. **`createCtx`**: builds the writer and a lazy `installSkill()`.
4. **Each adapter runs in order.** An error stops the run with `install: <message>` and exit 1. Adapters that already ran have already written their files.

### installSkill: one copy per run

```ts
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(SKILL_SRC, dest, { recursive: true });
```

It copies `skills/bubble/` (SKILL.md plus the compiled `scripts/`) to `<base>/.agents/skills/bubble`. The first adapter that needs it triggers the copy, and later ones reuse it. **The old copy is deleted first**, so local edits to an installed skill are lost on reinstall. This is also why the CLI and hooks are committed JS: the copy has to run with no build and no `node_modules`.

### The writer: idempotent, with backups

`write.file(target, content)`:

- same content as on disk → `= unchanged`, nothing written
- `--dry-run` → `~ would write`, nothing written
- otherwise → keeps the old file as `<target>.bak`, then writes

So re-running the installer is safe and only touches what changed. Dry run reports *which* files would change, not *how*.

## The adapters

| Agent | Copies skill | Writes | Gate |
|---|---|---|---|
| `claude` | no | nothing by default. With `--apply-statusline`: `~/.claude/settings.json` | comes with the plugin (`.claude-plugin/plugin.json`) |
| `codex` | yes | `<base>/.codex/hooks.json`: `PreToolUse`, matcher `apply_patch\|Edit\|Write` | hard |
| `gemini` | yes | `<base>/.gemini/settings.json`: `BeforeTool`, matcher `write_file\|replace`; plus `.gemini/commands/bubble.toml` | hard |
| `agents-md` | yes | a marked block in `<base>/AGENTS.md` | soft: only rules the agent reads |

**claude** is mostly instructions. Claude Code installs the skill and the gate as a **plugin**: this repo is its own marketplace (`.claude-plugin/marketplace.json`), and `plugin.json` registers the fog gate with `${CLAUDE_PLUGIN_ROOT}`. The installer prints the `/plugin` commands. A plugin can't set the status line, so it prints that snippet too, or writes it with `--apply-statusline` (warning if it replaces a status line that isn't ours).

**codex** and **gemini** share `settings.ts`:

```ts
settings.hooks[event] = [...(settings.hooks[event] || []).filter((g) => !isFogGate(g)), entry];
```

`upsertHook` removes any hook group whose command mentions `fog-gate.js`, then appends ours. Running it twice gives one entry, and an older path gets replaced. Everything else in the file is kept as is.

**gemini** also gets a `/bubble` slash command from `adapters/gemini/bubble.toml`. `template()` replaces only the keys it's given (`{{CLI}}`) and leaves unknown ones alone, which is how Gemini's own `{{args}}` survives. `!{node "…" show}` makes Gemini run `show` and paste the track into the prompt.

**agents-md** is for any agent that reads `AGENTS.md` and has no hook. It fills `adapters/agents-md.md` with **relative** paths and puts it between `<!-- bubble-tracks:start -->` / `:end -->` markers. If a block is already there (including from the old `bubble-coding` / `bubble-planner` names), it's replaced in place; otherwise it's appended. It's skipped with `--user`, because `AGENTS.md` is per repo.

## `--project` vs `--user`

| | `--project <dir>` (default: cwd) | `--user` |
|---|---|---|
| skill | `<dir>/.agents/skills/bubble` | `~/.agents/skills/bubble` |
| codex hook | `<dir>/.codex/hooks.json` | `~/.codex/hooks.json` |
| gemini hook | `<dir>/.gemini/settings.json` | `~/.gemini/settings.json` |
| AGENTS.md | `<dir>/AGENTS.md` | skipped |
| claude status line | always `~/.claude/settings.json` | same |

## Things worth knowing

- **Hook commands use absolute paths.** Codex and Gemini get `node "/abs/path/.agents/skills/bubble/scripts/cli/fog-gate.js"`. If you commit `.codex/hooks.json` or `.gemini/settings.json`, it only works on machines with the same path. `AGENTS.md` uses relative paths.
- **The Claude status line points at this repo, not at an installed copy.** It uses `SKILL_SRC` (the bubble-tracks checkout), so moving or deleting the checkout breaks the status line.
- **Settings files must be plain JSON.** A file with comments (JSONC) fails with `… is not plain JSON — add the entry by hand`.
- **`upsertHook` drops a whole group.** If you put our gate in the same hook group as your own hooks, reinstalling removes your hooks from that event too.
- **The help text has drifted.** The final "Done." line suggests `init "<title>"`, and the command list in `adapters/agents-md.md` leaves out `create`, `close`, `delete` and `handoff`.
- **No uninstall.** Remove `.agents/skills/bubble`, the hook entries and the `AGENTS.md` block by hand (or restore the `.bak` files).
