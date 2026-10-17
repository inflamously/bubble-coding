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
| `install/` | the installer, built | `src/install/` | yes |
| `dist/site/` | the demo, compiled | `src/site/` | no |
| `dist/pages/` | the demo, assembled for Pages (CI builds it on every deploy) | `dist/site/` + `demo/story.md` + the CLI | no |
| `.claude-plugin/` | Claude Code plugin: `plugin.json` (manifest + the fog-gate hook), `marketplace.json` | — | yes |
| `adapters/` | templates the installer fills in for other agents | — | yes |
| `demo/story.md` | the demo story, one source for the page and its test | — | yes |
| `install.js` | `node install.js …` entry, loads `install/` | — | yes |
| `test/` | `node --test` suites | — | yes |

## Rules

- **Never hand-edit built JS** (`skills/bubble/scripts/`, `install/`, `dist/`). Change the TypeScript
  in `src/`, then run `npm run build`. `test/build.test.js` fails when committed JS drifts from a fresh build.
- **Committed build output is what users run without a build step:** `skills/bubble/scripts/` (the
  plugin, the hooks and installed copies run it, and the installer copies the skill folder as is, so
  the skill must carry its own JS) and `install/` (`node install.js` from a fresh clone).
- **`dist/` is git-ignored** and only holds what gets rebuilt anyway: the demo, which CI builds on
  every deploy. Nothing a user runs may live there.
- **Three tsconfigs, three outputs.** `tsconfig.json`: `src/` → `skills/bubble/scripts/` (excludes
  `src/install` and `src/site`). `tsconfig.install.json`: `src/install/` → `install/`.
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
npm run build    # src -> skills/bubble/scripts, src/install -> install
npm test         # all suites, including the build-drift and demo-parity checks
npm run site     # src/site -> dist/site -> dist/pages
python3 -m http.server -d dist/pages   # preview the demo
npm run deploy   # redeploy GitHub Pages from master without a push (needs gh auth)
```

Pages deploys on every push to `master` (`.github/workflows/pages.yml`); the repo's Pages source
must be "GitHub Actions" (Settings → Pages).
