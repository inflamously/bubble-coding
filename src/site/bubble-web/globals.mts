// esbuild `inject` file (see build.mjs): every free `process` and `console` in the bundled CLI becomes these.
export { console, process } from './host.mjs';
