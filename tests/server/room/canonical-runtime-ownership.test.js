import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('cloudflare/server');
const RUNTIME_SEGMENT = `${path.sep}room${path.sep}runtime${path.sep}`;

async function collectSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fullPath.includes(RUNTIME_SEGMENT)) continue;
      out.push(...await collectSourceFiles(fullPath));
      continue;
    }
    if (!/\.(js|mjs)$/.test(entry.name)) continue;
    out.push(fullPath);
  }
  return out;
}

test('live server files do not import the isolated room runtime path', async () => {
  const files = await collectSourceFiles(ROOT);
  const offenders = [];
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    if (source.includes('/room/runtime/')) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
