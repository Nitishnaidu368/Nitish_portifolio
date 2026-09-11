# Nitish Portfolio RAG Chatbot

This portfolio includes a small retrieval-augmented generation (RAG) chatbot. It answers only from curated public portfolio data, shows the retrieved sources, and blocks private, unrelated, or prompt-injection requests.

## How the pipeline works

```text
Visitor question
      |
      v
Input validation and privacy/injection rules -- blocked --> safe local reply
      |
      v
Gemini query embedding
      |
      v
Cosine similarity against the local knowledge index
      |
      +-- below calibrated threshold --> off-topic local reply
      |
      v
Top three public chunks + strict system instruction
      |
      v
Gemini grounded answer --> output privacy check --> answer + source inspector
```

The knowledge index is generated ahead of deployment. A visitor request never re-embeds the full portfolio.

## Stage map

1. `knowledge/profile.json` — curated public knowledge source.
2. `lib/rag.mjs`, `lib/gemini-embeddings.mjs`, and `scripts/rag.mjs` — chunking, embeddings, similarity search, and index commands.
3. `knowledge/evaluation.json` — retrieval calibration plus privacy and prompt-injection cases.
4. `api/chat.mjs` — validated, grounded server-side Gemini endpoint.
5. `index.html`, `script.js`, and `styles.css` — chat UI, sources, and retrieval inspector.
6. Production readiness — quota handling, rate limiting, health check, security headers, tests, and deployment instructions.

## Local workflow

Requires a recent Node.js version with built-in `fetch` and a `.env` file containing `GEMINI_API_KEY`. The `.env` file is ignored by Git.

```sh
node --env-file=.env scripts/rag.mjs build
node --env-file=.env scripts/rag.mjs evaluate
node --test
```

Use `build` only after changing `knowledge/profile.json`. Use `evaluate` after rebuilding or changing the evaluation cases. Both commands consume embedding quota; `node --test` is fully offline and consumes none.

To inspect one retrieval result without generating an answer:

```sh
node --env-file=.env scripts/rag.mjs query "What AI projects has Nitish built?"
```

## Request and quota behavior

| Request result | Gemini API work |
| --- | --- |
| Invalid, private, or prompt injection | No call |
| Relevant-looking but off-topic after retrieval | One query embedding |
| Accepted portfolio question | One query embedding and one generation |
| `GET /api/chat` health check | No call |
| Automated test suite | No call |

The API allows three provider-backed attempts per visitor per minute in each warm serverless instance and does not retry failed provider calls automatically. This is a useful local backstop, not a deployment-wide guarantee because serverless instances do not share memory.

For production on Vercel, create one WAF rate-limit rule:

- Path: `/api/chat`
- Method: `POST`
- Counting key: IP
- Fixed window: 60 seconds
- Request limit: 3
- Action: return `429`

Check the project's current model-specific limits in Google AI Studio; Gemini quotas are enforced per project and can change. Adjust the WAF limit below the lowest relevant requests-per-minute allowance.

## Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Add `GEMINI_API_KEY` in Project Settings > Environment Variables for Production and Preview. Do not put it in `vercel.json` or browser JavaScript.
3. Deploy, then open `/api/chat` with a browser or `curl`. A ready deployment returns index status without using Gemini quota.
4. Add and publish the WAF rule above before sharing the portfolio publicly.
5. Verify one normal question, one unrelated question, and one private question. Only the normal question should generate an answer.

## Updating portfolio knowledge

Edit only public, recruiter-appropriate facts in `knowledge/profile.json`, rebuild the index, run evaluation and tests, inspect the diff, then commit both the profile and generated index. Never add personal identifiers or secrets to the knowledge source, prompts, tests, or Git history.

## Guardrail boundaries

The chatbot uses deterministic checks before and after generation, retrieval relevance, and a strict system instruction. These reduce risk but are not a proof of perfect model behavior. Keep the knowledge base public-only, monitor rejected/error traffic in Vercel, and strengthen the evaluation set whenever a real failure is discovered.
