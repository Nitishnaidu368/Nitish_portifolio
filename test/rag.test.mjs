import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { embedTexts } from '../lib/gemini-embeddings.mjs';
import {
  buildRetrievalQuery,
  calibrateThreshold,
  chunkDocuments,
  classifyQuestion,
  containsPrivateOutput,
  cosineSimilarity,
  retrieve,
  validateProfile
} from '../lib/rag.mjs';

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

test('blocks private and prompt-injection questions while allowing professional contact', async () => {
  const cases = JSON.parse(await readFile(new URL('../knowledge/evaluation.json', import.meta.url)));
  assert.ok(cases.sensitive.every(question => classifyQuestion(question) === 'sensitive'));
  assert.ok(cases.promptInjection.every(question => classifyQuestion(question) === 'blocked'));
  assert.ok(cases.offTopic.every(question => classifyQuestion(question) === 'allowed'));
  assert.ok(cases.inScope.every(item => classifyQuestion(item.query) === 'allowed'));
  assert.equal(classifyQuestion('What is Nitish\'s professional email?'), 'allowed');
  assert.equal(classifyQuestion('Tell me about his projects'), 'allowed');
});

test('screens private generated output but permits the approved public email', () => {
  assert.equal(containsPrivateOutput('Email Nitish at nitishnaidukandi@gmail.com.'), false);
  assert.equal(containsPrivateOutput('His number is +1 (555) 123-4567.'), true);
  assert.equal(containsPrivateOutput('Contact private@example.com.'), true);
  assert.equal(containsPrivateOutput('His immigration status is private.'), true);
});

test('adds only the two most recent messages to a retrieval query', () => {
  const query = buildRetrievalQuery('What did he build?', [
    { role: 'user', content: 'old question' },
    { role: 'assistant', content: 'Agentic systems.' },
    { role: 'user', content: 'Tell me about the medical project.' }
  ]);
  assert.doesNotMatch(query, /old question/);
  assert.match(query, /Agentic systems/);
  assert.match(query, /Current question: What did he build\?/);
});

test('calibrates immediately above the highest off-topic score', () => {
  const result = calibrateThreshold([0.82, 0.75, 0.61], [0.44, 0.5]);
  assert.equal(result.threshold, 0.501);
  assert.equal(result.recall, 1);
});
