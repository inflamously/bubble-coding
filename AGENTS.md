# AGENTS.md

Notes for coding agents working on this repo. (`adapters/agents-md.md` is something else: the
bubble-tracks section the installer writes into *users'* AGENTS.md.)

## Layout

| Path | What | Built from | Committed |
|---|---|---|---|
| `src/cli/`, `src/lib/` | CLI, fog gate, status line | — | yes |
| `src/skill-install/` | the installer | — | yes |
| `src/site/` | the GitHub Pages demo (see `src/site/README.md`) | — | yes |
| `skills/bubble/` | the skill: `SKILL.md`, `fallback.md` (no-Node hand edits, drift-tested) + `scripts/` | `scripts/` from `src/` | yes |
| `skill-install/` | the installer, built | `src/skill-install/` | yes |
| `dist/pages/` | the demo, bundled for Pages (CI builds it on every deploy) | `src/site/` + the CLI's `src/` + `demo/story.md` | no |
| `.claude-plugin/` | Claude Code plugin: `plugin.json` (manifest + the fog-gate hook), `marketplace.json` | — | yes |
| `adapters/` | templates the installer fills in for other agents | — | yes |
| `demo/story.md` | the demo story, one source for the page and its test | — | yes |
| `install.js` | `node install.js …` entry, loads `skill-install/` | — | yes |
| `build.mjs` | every build: `npm run build`, `site`, `check`; the tests import it | — | yes |
| `test/` | `node --test` suites | — | yes |

## Rules

- **Never hand-edit built JS** (`skills/bubble/scripts/`, `skill-install/`, `dist/`). Change the TypeScript
  in `src/`, then run `npm run build`. `test/build.test.js` fails when committed JS drifts from a fresh build.
- **Committed build output is what users run without a build step:** `skills/bubble/scripts/` (the
  plugin, the hooks and installed copies run it, and the installer copies the skill folder as is, so
  the skill must carry its own JS) and `skill-install/` (`node install.js` from a fresh clone).
- **`dist/` is git-ignored** and only holds what gets rebuilt anyway: the demo, which CI builds on
  every deploy. Nothing a user runs may live there.
- **One build script, two tools** (`build.mjs`). tsc emits the committed JS, one file per module with
  comments kept: `tsconfig.json`: `src/` → `skills/bubble/scripts/` (excludes `src/skill-install` and
  `src/site`); `tsconfig.skill-install.json`: `src/skill-install/` → `skill-install/`. The demo's
  `src/site/*/tsconfig.json` only type-check; esbuild bundles it into `dist/pages/`. Keep new code
  inside the one that ships it.
- **The demo runs the CLI's own code.** esbuild bundles `src/lib/cli/main.ts` into the page and swaps only
  what Node provides (`node:fs`, `node:path`, `process`, `console`; see `src/site/bubble-web/host.mts`).
  Don't change the CLI for the demo's sake;
  `test/web.test.js` replays the story on both and fails if the output differs.
- **No runtime dependencies.** Users run the committed JS with plain Node; `typescript`,
  `@types/node` and `esbuild` are dev-only.
- **LF line endings** (`.gitattributes`), so built output matches on every OS.
- **Planning lives in `.bubble-tracks/`** (committed; only `current` is git-ignored). Change it only through the CLI:
  `node skills/bubble/scripts/cli/bubble.js <command>`, never by editing the JSON.

## File shape

Every source file keeps the same order, top to bottom:

1. the header comment: what the file is for
2. imports
3. types and interfaces
4. constants (`const`, exported or not)
5. module-level variables (`let`)
6. functions, grouped by job (a short `// …` line may name a group); a helper goes before the functions that use it
7. classes
8. the default export, if there is one

## Commands

```
npm install      # dev only
npm run build    # src -> skills/bubble/scripts, src/skill-install -> skill-install
npm test         # all suites, including the build-drift and demo-parity checks
npm run site     # type-check src/site, then bundle it -> dist/pages
npm run check    # just the src/site type check
python3 -m http.server -d dist/pages   # preview the demo
npm run deploy   # redeploy GitHub Pages from master without a push (needs gh auth)
```

Pages deploys on every push to `master` (`.github/workflows/pages.yml`); the repo's Pages source
must be "GitHub Actions" (Settings → Pages).
