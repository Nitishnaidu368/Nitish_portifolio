export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

const PRIVATE_QUESTION_PATTERNS = [
  /\b(home|residential|mailing|street) address\b/i,
  /\b(where (does|is) (nitish|he) (currently )?live|current location|exact location)\b/i,
  /\b(phone|mobile|cell|telephone|whatsapp) (number|contact)?\b/i,
  /\b(age|birthday|date of birth|dob|how old)\b/i,
  /\b(family|parents?|siblings?|wife|husband|married|relationship status)\b/i,
  /\b(visa|immigration|citizenship|green card|work authorization)\b/i,
  /\b(salary|compensation|paycheck|social security|ssn|passport)\b/i,
  /\bpersonal (email|account|details?|information)\b/i
];

const INJECTION_PATTERNS = [
  /\bignore (all |the |your )?(previous|prior|above) (instructions?|rules?|prompts?)\b/i,
  /\b(reveal|show|print|repeat) (the |your )?(hidden )?(system|developer) (prompt|message|instructions?)\b/i,
  /\b(jailbreak|bypass (the |your )?(rules?|guardrails?))\b/i
];

const PRIVATE_OUTPUT_PATTERNS = [
  /\b\+?\d[\d(). -]{8,}\d\b/,
  /\b\d{1,5}\s+[A-Za-z0-9.' -]+\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct)\b/i,
  /\b(visa|immigration|citizenship|green card|salary|social security|passport)\b/i
];

const PUBLIC_EMAIL = 'nitishnaidukandi@gmail.com';

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

export function classifyQuestion(question) {
  if (typeof question !== 'string' || !question.trim()) return 'invalid';
  if (INJECTION_PATTERNS.some(pattern => pattern.test(question))) return 'blocked';
  if (PRIVATE_QUESTION_PATTERNS.some(pattern => pattern.test(question))) return 'sensitive';
  return 'allowed';
}

export function containsPrivateOutput(answer) {
  if (typeof answer !== 'string' || !answer.trim()) return true;
  if (PRIVATE_OUTPUT_PATTERNS.some(pattern => pattern.test(answer))) return true;
  const emails = answer.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return emails.some(email => email.toLowerCase() !== PUBLIC_EMAIL);
}

export function buildRetrievalQuery(question, history = []) {
  const recentContext = history
    .slice(-2)
    .filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .map(message => `${message.role}: ${message.content.trim()}`)
    .join('\n');
  return recentContext ? `${recentContext}\nCurrent question: ${question.trim()}` : question.trim();
}

export function calibrateThreshold(inScopeScores, offTopicScores) {
  const scores = [...inScopeScores, ...offTopicScores];
  if (!inScopeScores.length || !offTopicScores.length || scores.some(score => !Number.isFinite(score) || score < -1 || score > 1)) {
    throw new Error('Calibration requires valid in-scope and off-topic cosine scores.');
  }

  const threshold = Number((Math.max(...offTopicScores) + 0.001).toFixed(6));
  const accepted = inScopeScores.filter(score => score >= threshold).length;
  return { threshold, recall: accepted / inScopeScores.length };
}
