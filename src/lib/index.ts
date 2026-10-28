// bubble-tracks core, one import for hooks, the status line and tests.
// Pure Node, no dependencies, cross-platform paths. The pieces:
//   store.ts  find / name / load / save tracks     model.ts  types, active bubble, addressing
//   render/   one-line track + numbered listing    ops/      mutations, one file per operation
//   abilities.ts  find / parse the ability files /bubble:<name> runs
//   near.ts   near-miss track names, so switch doesn't create a slip of an existing one

export * from './store.js';
export * from './model.js';
export * from './render/index.js';
export * from './ops/index.js';
export * from './abilities.js';
export * from './near.js';
