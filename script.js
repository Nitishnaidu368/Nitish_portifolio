const answers = {
  skills: "I work with Java, Kotlin, Spring, React, Python, AWS, Docker, Kubernetes, Terraform, MCP, and LLMs.",
  projects: "I’ve built agentic AI systems, including an ad delivery optimization system and a medical diagnosis multi-agent system.",
  contact: "You can reach me at nitishnaidukandi@gmail.com.",
  experience: "I have worked as a Software Engineer at Accenture and Pandora Finance, and earlier as an Associate Software Engineer at Logicprog Technologies.",
  education: "I studied Data Science and Applications at the University at Buffalo, SUNY, and Computer Science and Engineering at VIT.",
  about: "I am a backend-first software engineer who loves building practical full-stack products, cloud-native systems, and agentic AI workflows that actually ship."
};

function getBotReply(message) {
  const text = message.toLowerCase();

  if (text.includes("about") || text.includes("who") || text.includes("personality")) return answers.about;
  if (text.includes("skill")) return answers.skills;
  if (text.includes("project")) return answers.projects;
  if (text.includes("experience") || text.includes("work")) return answers.experience;
  if (text.includes("education") || text.includes("study") || text.includes("college") || text.includes("university")) return answers.education;
  if (text.includes("contact") || text.includes("email")) return answers.contact;

  return "I’m not totally sure about that one, but you can email me and I’ll be happy to answer!";
}

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

function addChatMessage(text, sender) {
  if (!chatMessages) return;

  const message = document.createElement('div');
  message.className = `message ${sender}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;

  addChatMessage(cleanQuestion, 'user');
  addChatMessage(getBotReply(cleanQuestion), 'bot');
}

if (chatForm && chatInput) {
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    sendChatMessage(chatInput.value);
    chatInput.value = '';
    chatInput.focus();
  });
}

document.querySelectorAll('.quick-question').forEach(button => {
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
