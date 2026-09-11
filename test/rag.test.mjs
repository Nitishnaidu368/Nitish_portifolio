import test from 'node:test';
import assert from 'node:assert/strict';
import { embedTexts } from '../lib/gemini-embeddings.mjs';
import { chunkDocuments, cosineSimilarity, retrieve, validateProfile } from '../lib/rag.mjs';

const document = {
  id: 'project',
  title: 'Project',
  category: 'projects',
  url: '/projects.html',
  text: 'One short sentence. Another useful sentence. A final sentence about the project.'
};

test('validates and chunks profile documents without losing metadata', () => {
  assert.equal(validateProfile([document]).length, 1);
  const chunks = chunkDocuments([document], 100);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].documentId, document.id);
  assert.equal(chunks[0].category, document.category);
  assert.equal(chunks[0].text, document.text);
});

test('splits oversized text at the configured boundary', () => {
  const chunks = chunkDocuments([{ ...document, text: 'word '.repeat(60).trim() }], 100);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.text.length <= 100));
});

test('calculates cosine similarity and ranks the closest chunks first', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);

  const matches = retrieve([
    { id: 'cloud', embedding: [0.9, 0.1] },
    { id: 'frontend', embedding: [0.1, 0.9] }
  ], [1, 0], 1);
  assert.equal(matches[0].id, 'cloud');
});

test('sends document embedding configuration to Gemini without exposing it to callers', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
  };

  const vectors = await embedTexts(
    [{ title: 'Project', text: 'A portfolio project.' }],
    'RETRIEVAL_DOCUMENT',
    { apiKey: 'test-key', fetchImpl }
  );
  const body = JSON.parse(request.options.body);

  assert.match(request.url, /gemini-embedding-001:batchEmbedContents$/);
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  assert.equal(body.requests[0].embedContentConfig.taskType, 'RETRIEVAL_DOCUMENT');
  assert.equal(body.requests[0].embedContentConfig.title, 'Project');
  assert.equal(body.requests[0].embedContentConfig.outputDimensionality, 768);
  assert.equal(vectors[0].length, 768);
});
