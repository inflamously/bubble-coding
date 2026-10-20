---
name: example
description: Sample ability — check the active bubble is ready to build, then report
type: bubble
---
This file shows the ability format. Copy it, rename it, and write your own workflow here.
`type: bubble` runs against the active bubble; `type: track` runs against the whole track.

Workflow:
1. Restate the active bubble in one sentence, using its title and hint.
2. List the files it will likely touch, and anything unclear about it.
3. If something is unclear, suggest a hint for the human to add (`hint N <text>`). Don't add it yourself.
4. Report back in a few lines and stop. Don't start building the bubble.
