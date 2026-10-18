# 5. Ops and rendering

Two files in `lib/` hold most of what the bubble commands actually do:

| File | What it is | Touches disk? |
|---|---|---|
| `src/lib/ops/` | one function per bubble command (a file per operation, `index.ts` re-exports them); changes a `Track` in memory | no |
| `src/lib/render/` | turns a `Track` into text: `line.ts` (the one-line track), `list.ts` (the `show` listing), `symbols.ts` (symbols, colors, shortening) | no |

Both are pure in the sense that matters: they never read or write files and never look at other tracks. Loading, saving, the closed-track check and fork syncing all happen around them, in `lib/cli/bubbles.ts` (stop 6).

## ops/

### The contract

Every op has the same shape:

```ts
export function fill(track: Track, addr: Addr, title: string): string
```

- **In:** the loaded track, plus an address (`Addr` = `"3"`, `3` or `undefined`) and arguments.
- **Effect:** changes `track` in place.
- **Out:** a short message for the CLI to print, like `filled "Fog-only fill"`.
- **Failure:** `throw new Error(...)` with a message written for the agent to read and act on, like `"X" is done — confirm with the human, then re-run with --force`.

Addresses come from `model.ts`: `resolve(track, addr)` turns `"3"` into index `2`, and `undefined` into the active bubble (the first one that isn't done). `resolveRange` does the same for `N:M`. So "omitted = the active bubble" from SKILL.md is implemented in exactly one place.

### The ops

| Op | Command(s) | What it does | Refuses when |
|---|---|---|---|
| `add` | `add`, `insert at N` | new todo (or fog, title `???`) at the end or at position N; gives it an id | no title; bad position |
| `fog` | `fog [N\|N:M] [TYPE]` | sets state `fog`, optionally the type; **keeps the title** | any picked bubble is done and no `--force` |
| `setType` | `type [N] TYPE` | records the knowledge level | unknown type. Works on any state, not only fog |
| `fill` | `fill [N] <title>` | fog → todo with the human's title | bubble isn't fog (use `rename`) |
| `rename` | `rename N <title>` | changes a planned bubble's title | bubble is fog (use `fill`) |
| `hint` | `hint N <text\|->` | sets or clears the note | — |
| `remove` | `remove N[:M]` | splices the bubbles out | bad range |
| `move` | `move N[:M] to M` | moves a block so it **starts at M in the resulting track** | bad position (the block is put back first) |
| `setHandoff` | `handoff <note\|->` | stores `{ note, at: "YYYY-MM-DD HH:MM UTC" }` | empty note |
| `setTitle` | `title <text>` | renames the track | empty |
| `markFork` | `fork` | sets `bubble.fork = childRef`, makes sure it has an id | bubble done or already forked |
| `markDiverge` | `diverge` | appends to `bubble.sides` | — |
| `done` | `done` | active bubble → done | nothing active; active is fog |

`fill` and `rename` are two halves of one rule: **only the human plans fog**. The agent can retitle a planned bubble, but turning a `❓` into a step has its own verb, so it shows up in the transcript as a deliberate act.

`done` never takes an address. You can only pop the active bubble, so the track always fills from the left and "active = first not done" stays true.

### What lives outside ops

The ops know nothing about other tracks. The CLI wraps them:

- **Before** `done`: `links.checkForkFinished` refuses if the bubble's fork isn't finished.
- **After** saving: `syncForkTitle` / `syncTitle` (after `rename` / `title`) and `popFinishedParents` (after `done`) update the linked tracks.
- **Closed tracks:** the op runs in memory first, then the CLI throws before `saveTrack`, so nothing is written. One side effect: if the op itself fails, you see that error, not "track is closed".

### Things worth knowing

- **`remove` doesn't check links.** Removing a bubble that has a `fork` or `sides` leaves the child's `parent`/`origin` pointing at an id that no longer exists.
- **`fog` keeps the old title and hint.** The listing still shows the title; the one-line render hides it behind `❓ needs you` when the bubble is active.
- **`move` positions count after the block is lifted out.** `move 2 to 3` on `A B C D` gives `A C B D`.
- **`markFork`/`markDiverge` return the same bubble object** with `id` typed as present (`Object.assign(b, { id })`), so the caller can write the link without a non-null check.

## render/

### The one-line track: `render(track, opts)`

```
Src tour   S ●──●──●──●──◐──○──○──○ F   Hooks and statusline ‹ ◐ Ops and rendering › CLI entry
└ title ┘  └──────── every bubble ────────┘   └──────────── prev ‹ active › next ────────────┘
```

1. **Title**, or `Plan` if the track has none.
2. **The line:** one symbol per bubble, joined by `──`. Every bubble is drawn, however long the track; only the labels get shortened.
3. **The context**, which depends on the state:
   - closed → `🔒 closed`
   - everything done → `all done`
   - active is fog → `prev ‹ ❓ needs you › next`
   - otherwise → `prev ‹ ◐ active › next`, each title cut by `shorten` to 20 characters at a word boundary (if the boundary is past the halfway point), ending in `…`.

That 20-character cut is why SKILL.md asks for 2–4 word titles: a longer title becomes `Remove the nested…` in the line.

**Which symbol:** `symbolFor` checks fog, then done, then "is this the active index (or has the old `active` state)" → `◐`, else `○`. The active bubble isn't stored; it's computed with `activeIndex` on every render.

### The listing: `list(track, opts)`

What `show` prints under the line: `→` on the active row, a 1-based number (the address the commands use), symbol, state, title, then `[type]`, `⑂ fork`, `↗ side` links, and the hint on its own `↳` line. The handoff note is added by `cli/print.ts`, not here.

### Options and environment

| Setting | Effect |
|---|---|
| `opts.ascii` / `BUBBLES_ASCII=1` | `*` `@` `o` `?` `--` instead of `●` `◐` `○` `❓` `──`. `opts` wins when it's set |
| `opts.color` | ANSI: title green, line blue, context yellow. Off unless asked for |
| `NO_COLOR` | turns colour off, always |

The same `render` feeds the status line, `tracks` and the line after every CLI command, so they always match.
