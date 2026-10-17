/** POSIX path, just the parts the CLI uses. Relative paths resolve against `cwd()`. */
export interface PosixPath {
  sep: '/';
  normalize(p: string): string;
  resolve(...parts: string[]): string;
  join(...parts: string[]): string;
  isAbsolute(p: string): boolean;
  dirname(p: string): string;
  basename(p: string, ext?: string): string;
  relative(from: string, to: string): string;
}

export function makePath(cwd: () => string): PosixPath {
  const normalize = (p: string): string => {
    const absolute = p.startsWith('/');
    const out: string[] = [];
    for (const part of p.split('/')) {
      if (!part || part === '.') continue;
      if (part !== '..') out.push(part);
      else if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
    }
    const joined = out.join('/');
    return absolute ? `/${joined}` : joined || '.';
  };

  const resolve = (...parts: string[]): string => {
    // The last absolute part wins; everything after it is relative to it.
    const from = parts.findLastIndex((p) => p.startsWith('/'));
    const rest = parts.slice(Math.max(0, from)).filter(Boolean).join('/');
    return normalize(from < 0 ? `${cwd()}/${rest}` : rest);
  };

  const dirname = (p: string): string => {
    const n = normalize(p);
    const i = n.lastIndexOf('/');
    return i < 0 ? '.' : i === 0 ? '/' : n.slice(0, i);
  };

  const basename = (p: string, ext?: string): string => {
    const base = normalize(p).split('/').pop() ?? '';
    return ext && base.endsWith(ext) && base !== ext ? base.slice(0, -ext.length) : base;
  };

  const relative = (from: string, to: string): string => {
    const a = resolve(from).split('/').filter(Boolean);
    const b = resolve(to).split('/').filter(Boolean);
    let same = 0;
    while (same < a.length && same < b.length && a[same] === b[same]) same++;
    return [...a.slice(same).map(() => '..'), ...b.slice(same)].join('/');
  };

  return {
    sep: '/',
    normalize,
    resolve,
    join: (...parts) => normalize(parts.filter(Boolean).join('/')),
    isAbsolute: (p) => p.startsWith('/'),
    dirname,
    basename,
    relative,
  };
}
