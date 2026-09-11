const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatSubmit = document.getElementById('chatSubmit');
const chatCard = document.getElementById('chatCard');
const quickQuestions = [...document.querySelectorAll('.quick-question')];
const chatHistory = [];
let chatBusy = false;

function addChatMessage(text, sender, sources = [], state = '') {
  if (!chatMessages) return;

  const entry = document.createElement('div');
  entry.className = `chat-entry ${sender}`;
  const message = document.createElement('div');
  message.className = `message ${sender}${state ? ` ${state}` : ''}`;
  message.textContent = text;
  entry.appendChild(message);

  if (sources.length) {
    const chips = document.createElement('div');
    chips.className = 'chat-sources';
    chips.setAttribute('aria-label', 'Portfolio sources');

    for (const source of sources) {
      const chip = document.createElement(source.url?.startsWith('/') ? 'a' : 'span');
      chip.className = 'source-chip';
      chip.textContent = source.title;
      if (chip.tagName === 'A') chip.href = source.url;
      chips.appendChild(chip);
    }
    entry.appendChild(chips);

    const inspector = document.createElement('details');
    inspector.className = 'rag-inspector';
    const summary = document.createElement('summary');
    summary.textContent = 'How this answer was found';
    inspector.appendChild(summary);

    const explanation = document.createElement('p');
    explanation.className = 'rag-explanation';
    explanation.textContent = 'Similarity measures how closely each portfolio chunk matched the question; it is not an answer-confidence score.';
    inspector.appendChild(explanation);

    for (const source of sources) {
      const item = document.createElement('div');
      item.className = 'retrieval-item';
      const heading = document.createElement('strong');
      heading.textContent = source.title;
      const score = document.createElement('span');
      score.className = 'retrieval-score';
      score.textContent = `similarity ${Number(source.score).toFixed(3)}`;
      const excerpt = document.createElement('p');
      excerpt.textContent = source.excerpt;
      item.append(heading, score, excerpt);
      inspector.appendChild(item);
    }
    entry.appendChild(inspector);
  }

  chatMessages.appendChild(entry);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return entry;
}

function setChatBusy(busy) {
  chatBusy = busy;
  if (chatCard) chatCard.setAttribute('aria-busy', String(busy));
  if (chatInput) chatInput.disabled = busy;
  if (chatSubmit) {
    chatSubmit.disabled = busy;
    chatSubmit.textContent = busy ? 'Thinking…' : 'Send';
  }
  quickQuestions.forEach(button => { button.disabled = busy });
}

async function sendChatMessage(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || chatBusy) return;

  addChatMessage(cleanQuestion, 'user');
  const previousHistory = chatHistory.slice(-6);
  setChatBusy(true);
  const loading = addChatMessage('Searching the portfolio…', 'bot', [], 'loading');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanQuestion, history: previousHistory }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json();
    if (!response.ok || typeof result.answer !== 'string') {
      throw new Error(response.status === 429 ?
        'The portfolio assistant is taking a short quota break. Please try again in a minute.' : '');
    }
    loading?.remove();
    addChatMessage(result.answer, 'bot', Array.isArray(result.sources) ? result.sources : []);

    if (result.status === 'answered') {
      chatHistory.push(
        { role: 'user', content: cleanQuestion },
        { role: 'assistant', content: result.answer }
      );
      if (chatHistory.length > 6) chatHistory.splice(0, chatHistory.length - 6);
    }
  } catch (error) {
    loading?.remove();
    addChatMessage(error.message || 'I could not reach the portfolio knowledge service. Please try again.', 'bot', [], 'error');
  } finally {
    setChatBusy(false);
    if (chatInput) chatInput.focus();
  }
}

if (chatForm && chatInput) {
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    sendChatMessage(chatInput.value);
    chatInput.value = '';
  });
}

quickQuestions.forEach(button => {
  button.addEventListener('click', () => {
    const question = button.dataset.question || button.textContent;
    sendChatMessage(question);
    if (chatInput) chatInput.focus();
  });
});

// rotating specialty words
const words = ["agentic AI systems", "backend microservices", "full-stack products", "cloud-native infra", "MCP orchestration", "CI/CD pipelines", "multi-agent systems", "RAG frameworks", "microservices architecture", "REST APIs", "serverless computing", "cloud-native development", "agile development"];
let wi = 0, ci = 0, del = false;
const rotor = document.getElementById('rotor');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function type() {
  const w = words[wi];
  rotor.textContent = w.slice(0, ci);
  if (!del) { ci++; if (ci > w.length) { del = true; setTimeout(type, 1700); return } }
  else { ci--; if (ci === 0) { del = false; wi = (wi + 1) % words.length } }
  setTimeout(type, del ? 34 : 70);
}
if (rotor) { if (reduced) { rotor.textContent = words[0] } else { type() } }

// scroll reveal
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// cursor spotlight
if (!reduced) {
  document.addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--mx', e.clientX + 'px');
    document.documentElement.style.setProperty('--my', e.clientY + 'px');
  });
}

// 3D tilt on project cards
if (!reduced && matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.tilt').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = '' });
  });
}
