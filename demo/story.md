# Demo story

One run of the real CLI in a throwaway repo. Lines starting with `>` are captions: what the human
types to their agent, or what the agent says. They are not model output. Every `bubble …` line is a
real CLI call, and its output is shown as the CLI prints it. The demo script (bubble 2) plays these
scenes in order, and the recording and the playground both use that script.

## 1. Sketch

> human: plan a todo CLI: add items, list them, keep them between runs

```
bubble switch todo "Todo app"
bubble add "Data model"
bubble add ?
bubble add "Add command"
bubble add "List command"
bubble add "Polish output"
bubble add ?
```

> agent: two bubbles are fog. Classify them: `N: <what it is>` or `N:kk|ku|uk|uu`

## 2. The human plans the fog

> human: 2: persist to json   6:uu

```
bubble fill 2 "Persist to JSON"
bubble type 6 uu
```

## 3. Walk

> agent: implements "Data model"

```
bubble done
```

> agent: ⏸ stop, waiting for the human

## 4. Fork: build on a bubble

> human: persistence is bigger than one step, split it out

```
bubble fork storage
bubble add "Pick file format"
bubble add "Write and load"
bubble done
bubble done
```

The fork's last `done` also pops "Persist to JSON" back on `todo`.

## 5. Diverge: a different direction

> human: what about a web UI someday?

```
bubble switch todo
bubble diverge 3 web-ui "Web UI"
bubble add "Static page"
bubble add ?
bubble switch todo
```

## 6. Reshape the track

> human: list before add. And drop "Polish output", it's useless

```
bubble move 4 to 3
bubble remove 5
```

## 7. Park an idea as its own track

> human: cloud sync, later

```
bubble create sync "Cloud sync"
bubble add ?
bubble switch todo
```

## 8. Hand off

> agent: context is getting heavy, saving a handoff

```
bubble handoff "next: List command, then Add; #5 fog (uu) needs an interview"
```

> agent: Run `/clear`, then `/bubble switch todo`

## 9. Fresh chat: look around

```
clear
bubble tracks
bubble switch web-ui
```

## 10. Finish the small track

> human: 2: serve the list

```
bubble fill 2 "Serve the list"
bubble done
bubble done
bubble tracks
```

## 11. Under the hood

```
ls .bubble-tracks
cat .bubble-tracks/todo.json
cat .bubble-tracks/web-ui.json
```

`todo.json` holds `"fork": "storage.json"` on "Persist to JSON", along with `sides`, the handoff note
and stable bubble `id`s. `web-ui.json` points back with `origin`.
