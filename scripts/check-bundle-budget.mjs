import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');

const budgets = [
  { match: /^runtime-entry-.*\.js$/, maxBytes: 16 * 1024, label: 'runtime-entry' },
  { match: /^main-.*\.js$/, maxBytes: 112 * 1024, label: 'main' },
  { match: /^hitscan-.*\.js$/, maxBytes: 48 * 1024, label: 'hitscan', optional: true },
  { match: /^world-.*\.js$/, maxBytes: 24 * 1024, label: 'world' },
  { match: /^three\.min-.*\.js$/, maxBytes: 700 * 1024, label: 'three' }
];

function bytesFor(pattern, optional = false) {
  const files = fs.readdirSync(distAssetsDir);
  const matched = files.find((name) => pattern.test(name));
  if (!matched) {
    if (optional) return null;
    throw new Error(`Missing build artifact for pattern ${pattern}`);
  }
  const stat = fs.statSync(path.join(distAssetsDir, matched));
  return { name: matched, bytes: stat.size };
}

const failures = [];

for (const budget of budgets) {
  const artifact = bytesFor(budget.match, !!budget.optional);
  if (!artifact) continue;
  if (artifact.bytes > budget.maxBytes) {
    failures.push(
      `${budget.label} chunk ${artifact.name} is ${artifact.bytes} bytes, exceeds ${budget.maxBytes}`
    );
  }
}

if (failures.length) {
  console.error('Bundle budget check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Bundle budgets passed.');
