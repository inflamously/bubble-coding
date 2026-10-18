// Track mutations: each changes the track in place and returns a short message for the CLI.
// One file per operation; ops that belong together share one.

export * from './add';
export * from './fog';
export * from './rename';
export * from './hint';
export * from './remove';
export * from './move';
export * from './handoff';
export * from './mark';
export * from './done';
