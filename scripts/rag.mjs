import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { embedTexts } from '../lib/gemini-embeddings.mjs';
import {
  calibrateThreshold,
  classifyQuestion,
  chunkDocuments,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  retrieve
} from '../lib/rag.mjs';

const profileUrl = new URL('../knowledge/profile.json', import.meta.url);
const indexUrl = new URL('../knowledge/index.json', import.meta.url);
const evaluationUrl = new URL('../knowledge/evaluation.json', import.meta.url);

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
    relevanceThreshold: null,
    calibratedAt: null,
    chunks: chunks.map((chunk, position) => ({ ...chunk, embedding: embeddings[position] }))
  };

  await writeFile(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Built ${index.chunks.length} chunks with ${index.dimensions}-dimension embeddings.`);
  console.log(`Source hash: ${index.sourceHash}`);
}

async function query(question) {
  if (!question) throw new Error('Provide a question after the query command.');
  const policy = classifyQuestion(question);
  if (policy !== 'allowed') {
    console.log(`${policy.toUpperCase()}: the question was stopped before embedding or retrieval.`);
    return;
  }

  const index = await readJson(indexUrl);
  if (!index.chunks?.length) throw new Error('The index is empty. Run the build command first.');
  if (index.embeddingModel !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error('The index model does not match the query model. Rebuild the index.');
  }
  if (!Number.isFinite(index.relevanceThreshold)) {
    throw new Error('The index is not calibrated. Run the evaluate command first.');
  }

  const [embedding] = await embedTexts([{ text: question }], 'RETRIEVAL_QUERY');
  const matches = retrieve(index.chunks, embedding);
  const status = matches[0]?.score >= index.relevanceThreshold ? 'IN_SCOPE' : 'OFF_TOPIC';
  console.log(`${status}: best score ${matches[0]?.score.toFixed(4)}; threshold ${index.relevanceThreshold.toFixed(4)}`);
  for (const match of matches) {
    console.log(`\n${match.score.toFixed(4)}  ${match.title} [${match.category}]`);
    console.log(match.text);
  }
}

async function evaluate() {
  const index = await readJson(indexUrl);
  const cases = await readJson(evaluationUrl);
  if (!index.chunks?.length) throw new Error('The index is empty. Run the build command first.');

  const missedSensitive = cases.sensitive.filter(question => classifyQuestion(question) !== 'sensitive');
  const missedInjections = cases.promptInjection.filter(question => classifyQuestion(question) !== 'blocked');
  if (missedSensitive.length || missedInjections.length) {
    throw new Error(`Policy checks missed ${missedSensitive.length + missedInjections.length} blocked questions.`);
  }

  const questions = [
    ...cases.inScope.map(item => item.query),
    ...cases.offTopic
  ];
  const embeddings = await embedTexts(questions.map(text => ({ text })), 'RETRIEVAL_QUERY');
  const inScopeResults = cases.inScope.map((item, position) => ({
    ...item,
    matches: retrieve(index.chunks, embeddings[position])
  }));
  const offTopicResults = cases.offTopic.map((question, position) => ({
    query: question,
    matches: retrieve(index.chunks, embeddings[cases.inScope.length + position])
  }));
  const calibration = calibrateThreshold(
    inScopeResults.map(result => result.matches[0].score),
    offTopicResults.map(result => result.matches[0].score)
  );
  const categoryHits = inScopeResults.filter(result => result.matches.some(match => match.category === result.category));
  const accepted = inScopeResults.filter(result => result.matches[0].score >= calibration.threshold);
  const retrievalRecall = inScopeResults.filter(result =>
    result.matches[0].score >= calibration.threshold && result.matches.some(match => match.category === result.category)
  ).length / inScopeResults.length;

  console.log('\nIn-scope queries');
  for (const result of inScopeResults) {
    console.log(`${result.matches[0].score.toFixed(4)}  expected=${result.category}  top=${result.matches[0].category}  ${result.query}`);
  }
  console.log('\nOff-topic queries');
  for (const result of offTopicResults) {
    console.log(`${result.matches[0].score.toFixed(4)}  ${result.query}`);
  }
  console.log(`\nThreshold: ${calibration.threshold.toFixed(4)}`);
  console.log(`Accepted in-scope: ${accepted.length}/${inScopeResults.length}`);
  console.log(`Expected category in top 3: ${categoryHits.length}/${inScopeResults.length}`);
  console.log(`Combined retrieval recall: ${(retrievalRecall * 100).toFixed(0)}%`);

  if (retrievalRecall < 0.9) {
    throw new Error('Retrieval recall is below 90%. Improve the corpus or evaluation cases before accepting this threshold.');
  }

  index.relevanceThreshold = calibration.threshold;
  index.calibratedAt = new Date().toISOString();
  index.evaluation = {
    inScope: cases.inScope.length,
    offTopic: cases.offTopic.length,
    sensitive: cases.sensitive.length,
    promptInjection: cases.promptInjection.length,
    retrievalRecall
  };
  await writeFile(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
  console.log('Saved the calibrated threshold to knowledge/index.json.');
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'build') await build();
  else if (command === 'query') await query(args.join(' ').trim());
  else if (command === 'evaluate') await evaluate();
  else {
    console.error('Usage: node scripts/rag.mjs <build|evaluate|query "question">');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
