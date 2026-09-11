import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './rag.mjs';

const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

export async function embedTexts(items, taskType, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const key = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured.');

  const response = await (options.fetchImpl || fetch)(EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key
    },
    body: JSON.stringify({
      requests: items.map(item => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: item.text }] },
        // ponytail: batchEmbedContents currently ignores the nested config; use its supported top-level fields until that REST behavior changes.
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
        ...(taskType === 'RETRIEVAL_DOCUMENT' ? { title: item.title } : {})
      }))
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 30_000)
  });

  if (!response.ok) {
    const error = new Error(`Gemini embedding request failed with status ${response.status}.`);
    error.status = response.status;
    error.retryAfter = response.headers.get('retry-after');
    throw error;
  }

  const data = await response.json();
  const vectors = data.embeddings?.map(item => item.values);
  if (!vectors || vectors.length !== items.length || vectors.some(vector => vector.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error('Gemini returned an invalid embedding response.');
  }

  return vectors;
}
