---
name: mini-plan
description: Re-plan the rest of the track around its goal and guards, as one short proposal
type: track
---
A small version of the plan step, for later in a track when the bubbles ahead have drifted or grown vague.

Workflow:
1. Restate the track's goal in one line. If it has none, ask the human for it and stop there.
2. List the guards. Name any bubble ahead that would break one.
3. Check the bubbles ahead for seams: one bubble per use case, each hint naming its `Boundary:`.
   Flag bubbles that span several use cases, split a use case per file, or have no boundary.
4. Propose, as one compact list: renames, splits (`insert at`), merges or removals, new `Boundary:` hints,
   and guards to add. Work that serves another goal goes to `add --to <track>`, `fork` or `diverge`.
   Fog stays fog: you may add a `why`, never fill it.
5. Apply nothing. Report back and stop, so the human picks what to run.
