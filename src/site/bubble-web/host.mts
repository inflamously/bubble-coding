// What the bundled CLI gets instead of Node. build.mjs bundles it with node:fs and node:path resolved to
// node-fs.mts and node-path.mts, and with `process` and `console` injected from globals.mts. All four
// forward to the host of the command running right now, which a machine sets for one synchronous run.
import type { MemoryFs } from './fs.mjs';
import type { PosixPath } from './path.mjs';

export interface FakeProcess {
  argv: string[];
  env: Record<string, string>;
  cwd(): string;
  pid: number;
  exitCode: number | undefined;
  stdout: { isTTY: boolean };
  stdin: { isTTY: boolean };
}

export interface FakeConsole {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface Host {
  fs: MemoryFs;
  path: PosixPath;
  process: FakeProcess;
  console: FakeConsole;
}

let current: Host | undefined;
// Live bindings: globals.mts re-exports these, so the CLI's `process` and `console` follow each run.
export let process: FakeProcess;
export let console: FakeConsole;

/** The running command's host; throws if the CLI is touched outside `withHost`. */
export function host(): Host {
  if (!current) throw new Error('bubble-web: the CLI ran outside a machine');
  return current;
}

/** Run `fn` (one CLI invocation, synchronous) with `h` as its world. */
export function withHost<T>(h: Host, fn: () => T): T {
  current = h;
  process = h.process;
  console = h.console;
  try {
    return fn();
  } finally {
    current = undefined;
  }
}
