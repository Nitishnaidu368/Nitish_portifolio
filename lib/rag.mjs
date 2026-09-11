export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

export function validateProfile(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error('Profile must be a non-empty array.');
  }

  const ids = new Set();
  for (const document of documents) {
    for (const field of ['id', 'title', 'category', 'text']) {
      if (typeof document[field] !== 'string' || !document[field].trim()) {
        throw new Error(`Profile document is missing ${field}.`);
      }
    }
    if (ids.has(document.id)) throw new Error(`Duplicate profile id: ${document.id}`);
    ids.add(document.id);
  }

  return documents;
}

export function chunkDocuments(documents, maxCharacters = 800) {
  validateProfile(documents);
  if (!Number.isInteger(maxCharacters) || maxCharacters < 100) {
    throw new Error('Chunk size must be an integer of at least 100 characters.');
  }

  const chunks = [];
  for (const document of documents) {
    const sentences = document.text.trim().split(/(?<=[.!?])\s+/);
    let text = '';
    let part = 1;

    const addChunk = () => {
      if (!text) return;
      chunks.push({
        id: `${document.id}-${part++}`,
        documentId: document.id,
        title: document.title,
        category: document.category,
        url: document.url || '',
        text
      });
      text = '';
    };

    for (const sentence of sentences) {
      if (text && text.length + sentence.length + 1 > maxCharacters) addChunk();

      if (sentence.length <= maxCharacters) {
        text += `${text ? ' ' : ''}${sentence}`;
        continue;
      }

      for (const word of sentence.split(/\s+/)) {
        if (text && text.length + word.length + 1 > maxCharacters) addChunk();
        text += `${text ? ' ' : ''}${word}`;
      }
    }
    addChunk();
  }

  return chunks;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index];
    magnitudeA += a[index] ** 2;
    magnitudeB += b[index] ** 2;
  }

  return magnitudeA && magnitudeB ? dot / Math.sqrt(magnitudeA * magnitudeB) : 0;
}

export function retrieve(chunks, queryEmbedding, limit = 3) {
  // ponytail: a linear scan is ideal for this tiny corpus; use a vector database after measured search latency justifies it.
  return chunks
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
