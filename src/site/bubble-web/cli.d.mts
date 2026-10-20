// The CLI (src/lib/cli/main.ts), which build.mjs resolves this name to when it bundles bubble-web.
// It is type-checked with the Node build, not here: bubble-web never sees Node's types.
declare module 'bubble-cli' {
  /** One `bubble …` invocation against the current host (see host.mts). */
  export function run(): void;
}
