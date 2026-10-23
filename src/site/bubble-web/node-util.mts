// node:util for the bundled CLI: only parseArgs, from @pkgjs/parseargs (Node's own code, published as a package).
// @ts-expect-error the package ships no types; it is the API of node:util's parseArgs
export { parseArgs } from '@pkgjs/parseargs';
