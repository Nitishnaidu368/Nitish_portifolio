import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { embedTexts } from '../lib/gemini-embeddings.mjs';
import {
  chunkDocuments,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  retrieve
} from '../lib/rag.mjs';

const profileUrl = new URL('../knowledge/profile.json', import.meta.url);
const indexUrl = new URL('../knowledge/index.json', import.meta.url);

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function build() {
  const source = await readFile(profileUrl, 'utf8');
  const chunks = chunkDocuments(JSON.parse(source));
  const embeddings = await embedTexts(
    chunks.map(chunk => ({ text: chunk.text, title: chunk.title })),
    'RETRIEVAL_DOCUMENT'
  );

  const index = {
    version: 1,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    sourceHash: createHash('sha256').update(source).digest('hex'),
    generatedAt: new Date().toISOString(),
    chunks: chunks.map((chunk, position) => ({ ...chunk, embedding: embeddings[position] }))
  };

  await writeFile(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Built ${index.chunks.length} chunks with ${index.dimensions}-dimension embeddings.`);
  console.log(`Source hash: ${index.sourceHash}`);
}

async function query(question) {
  if (!question) throw new Error('Provide a question after the query command.');
  const index = await readJson(indexUrl);
  if (!index.chunks?.length) throw new Error('The index is empty. Run the build command first.');
  if (index.embeddingModel !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error('The index model does not match the query model. Rebuild the index.');
  }

  const [embedding] = await embedTexts([{ text: question }], 'RETRIEVAL_QUERY');
  for (const match of retrieve(index.chunks, embedding)) {
    console.log(`\n${match.score.toFixed(4)}  ${match.title} [${match.category}]`);
    console.log(match.text);
  }
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'build') await build();
  else if (command === 'query') await query(args.join(' ').trim());
  else {
    console.error('Usage: node scripts/rag.mjs <build|query "question">');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
