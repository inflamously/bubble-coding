// The real bubble-tracks CLI on a machine that lives in memory. build.mjs bundles the CLI's source
// (src/lib/cli/main.ts) with only what Node would provide swapped (see host.mts): node:fs is an
// in-memory disk, node:path is POSIX, and process and console are per-run fakes that capture output.
import { run } from 'bubble-cli';
import { makeFs, type MemoryFs } from './fs.mjs';
import { withHost, type FakeConsole, type FakeProcess } from './host.mjs';
import { makePath, type PosixPath } from './path.mjs';

export interface Output {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface RunResult {
  out: Output[];
  code: number;
}

export interface Machine {
  readonly fs: MemoryFs;
  readonly path: PosixPath;
  cwd(): string;
  /** Change directory; throws if `dir` isn't one. */
  cd(dir: string): void;
  /** One CLI process: `bubble <argv…>`. Colors are on unless `color: false`. */
  bubble(argv: string[], opts?: { color?: boolean }): RunResult;
}

export function createMachine(opts: { cwd?: string } = {}): Machine {
  let cwd = opts.cwd ?? '/home/demo';
  const path = makePath(() => cwd);
  const fs = makeFs(path);
  fs.mkdirSync(cwd, { recursive: true });

  return {
    fs,
    path,
    cwd: () => cwd,

    cd(dir) {
      const target = path.resolve(dir);
      if (!fs.dirs.has(target)) throw new Error(`cd: no such directory: ${dir}`);
      cwd = target;
    },

    bubble(argv, { color = true } = {}) {
      const { out, fakeConsole } = captureConsole();
      const proc = fakeProcess(argv, () => cwd, color);
      try {
        withHost({ fs, path, process: proc, console: fakeConsole }, run);
      } catch (err) {
        fakeConsole.error(`bubble-web: ${(err as Error).message}`);
        proc.exitCode = 1;
      }
      return { out, code: proc.exitCode ?? 0 };
    },
  };
}

/** A console whose log/error calls land in `out`, one entry per call, like lines on stdout/stderr. */
function captureConsole(): { out: Output[]; fakeConsole: FakeConsole } {
  const out: Output[] = [];
  const write = (stream: Output['stream']) => (...args: unknown[]) => {
    out.push({ stream, text: args.map(String).join(' ') + '\n' });
  };
  return { out, fakeConsole: { log: write('stdout'), error: write('stderr'), warn: write('stderr') } };
}

/** What `node bubble.js <argv…>` would see in `process`. Colors follow `color`, as on a terminal. */
function fakeProcess(argv: string[], cwd: () => string, color: boolean): FakeProcess {
  return {
    argv: ['node', '/bubble/cli/bubble.js', ...argv],
    env: { BUBBLES_COLOR: color ? '1' : '0' },
    cwd,
    pid: 1,
    exitCode: undefined,
    stdout: { isTTY: color },
    stdin: { isTTY: false },
  };
}
