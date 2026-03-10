import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('auth form uses JS validation instead of blocking on native pattern UI', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<form id="auth-form" novalidate>/);
  assert.match(html, /id="auth-pin"[^>]*pattern="\[0-9\]\{4\}"/);
});
