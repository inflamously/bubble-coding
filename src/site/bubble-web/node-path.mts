// node:path for the bundled CLI (see host.mts): POSIX, relative to the machine's cwd.
import type { PosixPath } from './path.mjs';
import { host } from './host.mjs';

export const sep: PosixPath['sep'] = '/';
export const normalize: PosixPath['normalize'] = (p) => host().path.normalize(p);
export const resolve: PosixPath['resolve'] = (...parts) => host().path.resolve(...parts);
export const join: PosixPath['join'] = (...parts) => host().path.join(...parts);
export const isAbsolute: PosixPath['isAbsolute'] = (p) => host().path.isAbsolute(p);
export const dirname: PosixPath['dirname'] = (p) => host().path.dirname(p);
export const basename: PosixPath['basename'] = (p, ext) => host().path.basename(p, ext);
export const relative: PosixPath['relative'] = (from, to) => host().path.relative(from, to);
