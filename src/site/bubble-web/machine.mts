// The real bubble-tracks CLI on a machine that lives in memory. The committed JS from
// skills/bubble/scripts runs unchanged; only what Node would provide is swapped: node:fs is an
// in-memory disk, node:path is POSIX, and process and console are per-run fakes that capture output.
import { makeFs, type MemoryFs } from './fs.mjs';
import { makePath, type PosixPath } from './path.mjs';

/** The CLI's CommonJS files, keyed by path under skills/bubble/scripts ("cli/bubble.js", "lib/store.js"). */
export type Sources = Record<string, string>;

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

interface FakeProcess {
  argv: string[];
  env: Record<string, string>;
  cwd(): string;
  pid: number;
  exitCode: number | undefined;
  stdout: { isTTY: boolean };
  stdin: { isTTY: boolean };
}

interface FakeConsole {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

/** The free variables every CLI module sees, besides require, module and exports. */
interface Globals {
  process: FakeProcess;
  console: FakeConsole;
}

export function createMachine(sources: Sources, opts: { cwd?: string } = {}): Machine {
  let cwd = opts.cwd ?? '/home/demo';
  const path = makePath(() => cwd);
  const fs = makeFs(path);
  fs.mkdirSync(cwd, { recursive: true });
  const builtins: Record<string, unknown> = { 'node:fs': fs, fs, 'node:path': path, path };

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
        runCommonJs(sources, 'cli/bubble.js', builtins, { process: proc, console: fakeConsole }, path);
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

/**
 * Run CommonJS `sources` starting at `entry`, with a fresh module cache (like a fresh process).
 * `require` answers `builtins` by name and everything else relative to the requiring file.
 */
function runCommonJs(sources: Sources, entry: string, builtins: Record<string, unknown>, globals: Globals, path: PosixPath): void {
  const cache = new Map<string, { exports: unknown }>();

  const load = (file: string): unknown => {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    if (!(file in sources)) throw new Error(`no module ${file}`);
    const module = { exports: {} as unknown };
    cache.set(file, module);
    const require = (id: string): unknown => (id in builtins ? builtins[id] : load(resolveRelative(path, sources, file, id)));
    new Function('exports', 'require', 'module', 'process', 'console', sources[file])(module.exports, require, module, globals.process, globals.console);
    return module.exports;
  };

  load(entry);
}

/**
 * The source key `require(id)` means from `file`, as Node resolves it: "lib/cli/args.js" + "../index" → "lib/index.js",
 * and a folder to its index: "lib/index.js" + "./ops" → "lib/ops/index.js".
 */
function resolveRelative(path: PosixPath, sources: Sources, file: string, id: string): string {
  if (!id.startsWith('.')) throw new Error(`no module ${id}`);
  const dir = path.dirname(file);
  const rel = path.normalize(dir === '.' ? id : `${dir}/${id}`);
  if (rel.endsWith('.js')) return rel;
  return `${rel}.js` in sources ? `${rel}.js` : `${rel}/index.js`;
}
