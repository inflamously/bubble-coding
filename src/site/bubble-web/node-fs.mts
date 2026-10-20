// node:fs for the bundled CLI (see host.mts): the machine's in-memory disk.
import type { MemoryFs } from './fs.mjs';
import { host } from './host.mjs';

export const existsSync: MemoryFs['existsSync'] = (p) => host().fs.existsSync(p);
export const statSync: MemoryFs['statSync'] = (p) => host().fs.statSync(p);
export const mkdirSync: MemoryFs['mkdirSync'] = (p, opts) => host().fs.mkdirSync(p, opts);
export const readdirSync: MemoryFs['readdirSync'] = (p) => host().fs.readdirSync(p);
export const readFileSync: MemoryFs['readFileSync'] = (p, encoding) => host().fs.readFileSync(p, encoding);
export const writeFileSync: MemoryFs['writeFileSync'] = (p, data) => host().fs.writeFileSync(p, data);
export const renameSync: MemoryFs['renameSync'] = (from, to) => host().fs.renameSync(from, to);
export const unlinkSync: MemoryFs['unlinkSync'] = (p) => host().fs.unlinkSync(p);
