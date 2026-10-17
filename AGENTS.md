# AGENTS.md

Notes for coding agents working on this repo. (`adapters/agents-md.md` is something else: the
bubble-coding section the installer writes into *users'* AGENTS.md.)

## Layout

| Path | What | Built from | Committed |
|---|---|---|---|
| `src/*.ts`, `src/lib/` | CLI, fog gate, status line | — | yes |
| `src/install/` | the installer | — | yes |
| `src/site/` | the GitHub Pages demo (see `src/site/README.md`) | — | yes |
| `skills/bubble/` | the skill: `SKILL.md` + `scripts/` | `scripts/` from `src/` | yes |
| `dist/install/` | the installer, built | `src/install/` | yes |
| `dist/site/` | the demo, compiled | `src/site/` | no |
| `_site/` | the demo, assembled for Pages | `dist/site/` + `demo/story.md` + the CLI | no |
| `hooks/hooks.json`, `.claude-plugin/` | Claude Code plugin wiring | — | yes |
| `adapters/` | templates the installer fills in for other agents | — | yes |
| `demo/story.md` | the demo story, one source for the page and its test | — | yes |
| `install.js` | `node install.js …` entry, loads `dist/install/` | — | yes |
| `test/` | `node --test` suites | — | yes |

## Rules

- **Never hand-edit built JS** (`skills/bubble/scripts/`, `dist/`). Change the TypeScript in `src/`,
  then run `npm run build`. `test/build.test.js` fails when committed JS drifts from a fresh build.
- **`skills/bubble/scripts/` stays inside the skill.** The plugin, the hooks and installed copies run
  it from there, and the installer copies the skill folder as is, so the skill must carry its own JS.
  Everything else that is built goes under `dist/`.
- **Three tsconfigs, three outputs.** `tsconfig.json`: `src/` → `skills/bubble/scripts/` (excludes
  `src/install` and `src/site`). `tsconfig.install.json`: `src/install/` → `dist/install/`.
  `src/site/*/tsconfig.json`: `src/site/` → `dist/site/`. Keep new code inside the one that ships it.
- **The demo runs the committed CLI unchanged.** `src/site/bubble-web` swaps only what Node provides
  (`node:fs`, `node:path`, `process`, `console`). Don't change the CLI for the demo's sake;
  `test/web.test.js` replays the story on both and fails if the output differs.
- **No runtime dependencies.** Users run the committed JS with plain Node; `typescript` and
  `@types/node` are dev-only.
- **LF line endings** (`.gitattributes`), so built output matches on every OS.
- **Planning lives in `.bubbles/`** (git-ignored). Change it only through the CLI:
  `node skills/bubble/scripts/bubble.js <command>`, never by editing the JSON.

## Commands

```
npm install      # dev only
npm run build    # src -> skills/bubble/scripts, src/install -> dist/install
npm test         # all suites, including the build-drift and demo-parity checks
npm run site     # src/site -> dist/site -> _site
python3 -m http.server -d _site   # preview the demo
```
