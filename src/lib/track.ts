// bubble-coding core, one import for hooks, the status line and tests.
// Pure Node, no dependencies, cross-platform paths. The pieces:
//   store.ts  find / name / load / save tracks     model.ts  types, active bubble, addressing
//   render.ts one-line track + numbered listing    ops.ts    mutations

export * from './store';
export * from './model';
export * from './render';
export * from './ops';
