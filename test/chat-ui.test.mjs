import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the chat page, client, and retrieval inspector contract aligned', async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="chatCard"/);
  assert.match(html, /id="chatSubmit"/);
  assert.match(html, /maxlength="600"/);
  assert.match(script, /fetch\('\/api\/chat'/);
  assert.match(script, /chatHistory\.slice\(-6\)/);
  assert.match(script, /How this answer was found/);
  assert.match(script, /short quota break/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(styles, /\.rag-inspector/);
  assert.match(styles, /\.source-chip/);
});
