import type { PosixPath } from './path.mjs';

export interface Stats {
  isDirectory(): boolean;
  isFile(): boolean;
}

/** An in-memory disk with the synchronous node:fs calls the CLI makes. Paths are absolute. */
export interface MemoryFs {
  readonly files: Map<string, string>;
  readonly dirs: Set<string>;
  existsSync(p: string): boolean;
  statSync(p: string): Stats;
  mkdirSync(p: string, opts?: { recursive?: boolean }): string | undefined;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding?: string): string;
  writeFileSync(p: string, data: string): void;
  renameSync(from: string, to: string): void;
  unlinkSync(p: string): void;
}

/** An Error shaped like Node's, so the CLI's `err.code` checks still work. */
const fail = (code: string, op: string, p: string): Error => Object.assign(new Error(`${code}: ${op} '${p}'`), { code });

export function makeFs(path: PosixPath): MemoryFs {
  const files = new Map<string, string>();
  const dirs = new Set<string>(['/']);
  const abs = (p: string) => path.resolve(p);
  const needParent = (p: string, op: string) => {
    if (!dirs.has(path.dirname(p))) throw fail('ENOENT', op, p);
  };
  const needFile = (p: string, op: string) => {
    if (!files.has(p)) throw fail(dirs.has(p) ? 'EISDIR' : 'ENOENT', op, p);
  };

  return {
    files,
    dirs,

    existsSync: (p) => files.has(abs(p)) || dirs.has(abs(p)),

    statSync(p) {
      const a = abs(p);
      if (!files.has(a) && !dirs.has(a)) throw fail('ENOENT', 'stat', a);
      return { isDirectory: () => dirs.has(a), isFile: () => files.has(a) };
    },

    /** Like Node: returns the first directory it created when `recursive`, else undefined. */
    mkdirSync(p, opts) {
      const a = abs(p);
      if (!opts?.recursive) {
        if (dirs.has(a)) throw fail('EEXIST', 'mkdir', a);
        needParent(a, 'mkdir');
        dirs.add(a);
        return undefined;
      }
      const missing: string[] = [];
      for (let d = a; !dirs.has(d); d = path.dirname(d)) missing.unshift(d);
      for (const d of missing) dirs.add(d);
      return missing[0];
    },

    readdirSync(p) {
      const a = abs(p);
      if (!dirs.has(a)) throw fail('ENOENT', 'scandir', a);
      const prefix = a === '/' ? '/' : `${a}/`;
      const names = new Set<string>();
      for (const entry of [...files.keys(), ...dirs]) {
        if (entry !== a && entry.startsWith(prefix)) names.add(entry.slice(prefix.length).split('/')[0]);
      }
      return [...names].sort();
    },

    readFileSync(p) {
      const a = abs(p);
      needFile(a, 'open');
      return files.get(a) as string;
    },

    writeFileSync(p, data) {
      const a = abs(p);
      needParent(a, 'open');
      files.set(a, String(data));
    },

    renameSync(from, to) {
      const a = abs(from);
      needFile(a, 'rename');
      needParent(abs(to), 'rename');
      files.set(abs(to), files.get(a) as string);
      files.delete(a);
    },

    unlinkSync(p) {
      const a = abs(p);
      needFile(a, 'unlink');
      files.delete(a);
    },
  };
}
