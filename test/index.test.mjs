import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chunkDocuments, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../lib/rag.mjs';

test('keeps the committed knowledge index current and deployable', async () => {
  const profileSource = await readFile(new URL('../knowledge/profile.json', import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../knowledge/index.json', import.meta.url), 'utf8'));
  const expectedChunks = chunkDocuments(JSON.parse(profileSource));
  const indexedChunks = index.chunks.map(({ embedding, ...chunk }) => chunk);

  assert.equal(index.sourceHash, createHash('sha256').update(profileSource).digest('hex'),
    'knowledge/profile.json changed without rebuilding the index');
  assert.equal(index.embeddingModel, EMBEDDING_MODEL);
  assert.equal(index.dimensions, EMBEDDING_DIMENSIONS);
  assert.ok(Number.isFinite(index.relevanceThreshold), 'index must be calibrated');
  assert.deepEqual(indexedChunks, expectedChunks);
  assert.ok(index.chunks.every(chunk =>
    chunk.embedding.length === EMBEDDING_DIMENSIONS && chunk.embedding.every(Number.isFinite)
  ), 'every chunk must have a valid embedding');
});
