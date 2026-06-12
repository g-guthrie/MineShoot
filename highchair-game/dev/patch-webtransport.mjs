/**
 * patch-webtransport.mjs - @fails-components/webtransport only declares
 * "node"/"browser" import conditions, which breaks tsx's CommonJS
 * resolution path. Node 22.12+ can require() ESM, so adding a "default"
 * condition makes the package loadable. Run after npm install:
 *
 *   node dev/patch-webtransport.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const path = 'node_modules/@fails-components/webtransport/package.json';
const pkg = JSON.parse(readFileSync(path, 'utf8'));

if (!pkg.exports?.['.']?.default) {
  pkg.exports['.'].default = './lib/index.node.js';
  writeFileSync(path, JSON.stringify(pkg, null, 2));
  console.log('patched', path);
} else {
  console.log('already patched');
}
