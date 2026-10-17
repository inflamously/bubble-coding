'use strict';
// The real Bubble CLI in a browser. The committed JS from skills/bubble/scripts runs unchanged; only
// what Node would provide is swapped: node:fs is an in-memory disk, node:path is POSIX, and process
// and console are per-run fakes that capture the output. Nothing here knows the bubble language.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BubbleWeb = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** POSIX path, just the parts the CLI uses. */
  function makePath(cwd) {
    const normalize = (p) => {
      const abs = p.startsWith('/');
      const out = [];
      for (const part of p.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
          if (out.length && out[out.length - 1] !== '..') out.pop();
          else if (!abs) out.push('..');
        } else out.push(part);
      }
      const s = out.join('/');
      return abs ? '/' + s : s || '.';
    };
    const resolve = (...parts) => {
      let p = '';
      for (let i = parts.length - 1; i >= 0 && !p.startsWith('/'); i--) if (parts[i]) p = parts[i] + (p ? '/' + p : '');
      return normalize(p.startsWith('/') ? p : cwd() + '/' + p);
    };
    return {
      sep: '/',
      normalize,
      resolve,
      join: (...parts) => normalize(parts.filter(Boolean).join('/')),
      isAbsolute: (p) => p.startsWith('/'),
      dirname: (p) => {
        const i = normalize(p).lastIndexOf('/');
        return i < 0 ? '.' : i === 0 ? '/' : normalize(p).slice(0, i);
      },
      basename: (p, ext) => {
        const b = normalize(p).split('/').pop();
        return ext && b.endsWith(ext) && b !== ext ? b.slice(0, -ext.length) : b;
      },
      relative: (from, to) => {
        const a = resolve(from).split('/').filter(Boolean);
        const b = resolve(to).split('/').filter(Boolean);
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/');
      },
    };
  }

  /** An in-memory disk with the synchronous fs calls the CLI makes. */
  function makeFs(path) {
    const files = new Map();
    const dirs = new Set(['/']);
    const fail = (code, op, p) => Object.assign(new Error(`${code}: ${op} '${p}'`), { code });
    const abs = (p) => path.resolve(p);
    const parentOk = (p, op) => {
      if (!dirs.has(path.dirname(p))) throw fail('ENOENT', op, p);
    };
    const fs = {
      files,
      dirs,
      existsSync: (p) => files.has(abs(p)) || dirs.has(abs(p)),
      statSync: (p) => {
        const a = abs(p);
        if (!files.has(a) && !dirs.has(a)) throw fail('ENOENT', 'stat', a);
        return { isDirectory: () => dirs.has(a), isFile: () => files.has(a) };
      },
      mkdirSync: (p, opts) => {
        const a = abs(p);
        if (dirs.has(a)) {
          if (opts && opts.recursive) return undefined;
          throw fail('EEXIST', 'mkdir', a);
        }
        if (opts && opts.recursive) {
          let first;
          for (let d = a; !dirs.has(d); d = path.dirname(d)) first = d;
          for (let d = a; !dirs.has(d); d = path.dirname(d)) dirs.add(d);
          return first;
        }
        parentOk(a, 'mkdir');
        dirs.add(a);
        return undefined;
      },
      readdirSync: (p) => {
        const a = abs(p);
        if (!dirs.has(a)) throw fail('ENOENT', 'scandir', a);
        const prefix = a === '/' ? '/' : a + '/';
        const names = new Set();
        for (const entry of [...files.keys(), ...dirs]) {
          if (entry !== a && entry.startsWith(prefix)) names.add(entry.slice(prefix.length).split('/')[0]);
        }
        return [...names].sort();
      },
      readFileSync: (p) => {
        const a = abs(p);
        if (!files.has(a)) throw fail(dirs.has(a) ? 'EISDIR' : 'ENOENT', 'open', a);
        return files.get(a);
      },
      writeFileSync: (p, data) => {
        const a = abs(p);
        parentOk(a, 'open');
        files.set(a, String(data));
      },
      renameSync: (from, to) => {
        const a = abs(from);
        if (!files.has(a)) throw fail('ENOENT', 'rename', a);
        parentOk(abs(to), 'rename');
        files.set(abs(to), files.get(a));
        files.delete(a);
      },
      unlinkSync: (p) => {
        const a = abs(p);
        if (!files.has(a)) throw fail('ENOENT', 'unlink', a);
        files.delete(a);
      },
    };
    return fs;
  }

  /**
   * A machine to run the CLI on. `sources` maps paths under skills/bubble/scripts (like
   * "bubble.js", "lib/store.js") to their source text.
   */
  function createMachine(sources, opts) {
    let cwd = (opts && opts.cwd) || '/home/demo/todo-app';
    const path = makePath(() => cwd);
    const fs = makeFs(path);
    fs.mkdirSync(cwd, { recursive: true });

    /** One CLI process: fresh modules, its own process and console. Returns its output and exit code. */
    function bubble(argv, runOpts) {
      const color = !(runOpts && runOpts.color === false);
      const out = [];
      const write = (stream) => (...a) => out.push({ stream, text: a.map(String).join(' ') + '\n' });
      const proc = {
        argv: ['node', '/bubble/bubble.js', ...argv],
        env: color ? { BUBBLES_COLOR: '1' } : { BUBBLES_COLOR: '0' },
        cwd: () => cwd,
        pid: 1,
        exitCode: undefined,
        stdout: { isTTY: color },
        stdin: { isTTY: false },
      };
      const cons = { log: write('stdout'), error: write('stderr'), warn: write('stderr') };
      const cache = new Map();
      const load = (file) => {
        if (cache.has(file)) return cache.get(file).exports;
        if (!(file in sources)) throw new Error(`bubble-web: no module ${file}`);
        const module = { exports: {} };
        cache.set(file, module);
        const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
        const req = (id) => {
          if (id === 'node:fs' || id === 'fs') return fs;
          if (id === 'node:path' || id === 'path') return path;
          if (!id.startsWith('.')) throw new Error(`bubble-web: no module ${id}`);
          const rel = path.normalize((dir ? dir + '/' : '') + id);
          return load(rel.endsWith('.js') ? rel : rel + '.js');
        };
        new Function('exports', 'require', 'module', 'process', 'console', sources[file])(module.exports, req, module, proc, cons);
        return module.exports;
      };
      try {
        load('bubble.js');
      } catch (err) {
        cons.error(`bubble-web: ${err.message}`);
        proc.exitCode = 1;
      }
      return { out, code: proc.exitCode || 0 };
    }

    return {
      fs,
      path,
      bubble,
      cwd: () => cwd,
      cd: (dir) => {
        const a = path.resolve(dir);
        if (!fs.dirs.has(a)) throw new Error(`cd: no such directory: ${dir}`);
        cwd = a;
      },
    };
  }

  /** Split a command line like a shell: spaces separate words, '…' and "…" group them. */
  function words(line) {
    const out = [];
    let cur = null;
    let quote = null;
    for (const ch of line) {
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        cur = cur || '';
      } else if (/\s/.test(ch)) {
        if (cur !== null) out.push(cur);
        cur = null;
      } else cur = (cur || '') + ch;
    }
    if (quote) throw new Error('unterminated quote');
    if (cur !== null) out.push(cur);
    return out;
  }

  return { createMachine, words };
});
