# 1. Big picture map

`src/` is about 2,500 lines of TypeScript with no runtime dependencies. It builds into three separate outputs, and each folder belongs to exactly one of them.

```
src/
├── bubble.ts        ← the CLI  (node bubble.js move 2 to 5)
├── fog-gate.ts      ← hook: blocks edits while the active bubble is fog
├── statusline.ts    ← Claude Code status line: prints the S ●──◐──○ F line
├── lib/             ← the core, shared by all three entry points above
│   ├── index.ts     ← one import that re-exports store/model/render/ops
│   ├── model.ts     ← types: Track, Bubble, states, addressing (N, N:M)
│   ├── store.ts     ← find / load / save .bubble-tracks/*.json
│   ├── render.ts    ← draws the track line and the numbered list
│   ├── ops.ts       ← the changes: add, move, fog, fill, done…
│   ├── links.ts     ← fork/diverge links between tracks
│   ├── io.ts        ← hook helpers: read stdin JSON, find target paths
│   └── cli/         ← args.ts (parsing + HELP), tracks.ts, bubbles.ts, print.ts
├── skill-install/   ← the installer (node install.js), one file per agent
└── site/            ← the GitHub Pages demo (.mts, browser + build scripts)
```

## How each part gets built

| Source | Config | Output | Who runs it |
|---|---|---|---|
| `src/*.ts` + `lib/` | `tsconfig.json` | `skills/bubble/scripts/` (JS checked into the repo) | agents and hooks, in every repo it's installed into |
| `src/skill-install/` | `tsconfig.skill-install.json` | `skill-install/` | `node install.js` |
| `src/site/` | `src/site/*/tsconfig.json` | `dist/site/` → `dist/pages/` | GitHub Pages (`npm run site`) |

## Things worth knowing

- **The compiled JS is checked into the repo.** `test/build.test.js` fails if it falls out of sync with `src/`, so after changing `src/` you run `npm run build`.
- **There are three entry points and one core.** `bubble.ts`, `fog-gate.ts` and `statusline.ts` are each about 25 lines and contain no logic of their own. They all import `lib` (`lib/index.ts`).
- **Data flows in one direction:** `model` (types) ← `store` / `render` / `ops` ← `cli/*` ← `bubble.ts`. Only `links.ts` and `cli/` work across several tracks; everything else deals with one track at a time.
- **The installer is kept out of `skills/bubble/scripts/` on purpose**, because that folder gets copied into every repo the tool is installed into.
- **The demo site runs the real CLI in the browser.** `site/bubble-web/` fakes `node:fs`, `path` and `process`, so the checked-in `bubble.js` runs unchanged.
