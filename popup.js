const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const generateBtn = document.getElementById('generateBtn');
const output = document.getElementById('output');
const loading = document.getElementById('loading');
const statusBar = document.getElementById('status-bar');
const questionsList = document.getElementById('questions-list');
const problemTitle = document.getElementById('problem-title');

chrome.storage.local.get('geminiApiKey', ({ geminiApiKey }) => {
  if (geminiApiKey) {
    apiKeyInput.value = geminiApiKey;
    generateBtn.disabled = false;
    showStatus('API key loaded ✓', 'success');
  }
});

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return showStatus('Enter a valid API key.', 'error');
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    generateBtn.disabled = false;
    showStatus('API key saved ✓', 'success');
  });
});

generateBtn.addEventListener('click', async () => {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  if (!geminiApiKey) return showStatus('Save your API key first.', 'error');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url?.includes('leetcode.com/problems/')) {
    return showStatus('Open a LeetCode problem page first.', 'error');
  }

  let problemData;
  try {
    problemData = await chrome.tabs.sendMessage(tab.id, { action: 'getProblemData' });
  } catch {
    return showStatus('Could not read page. Refresh LeetCode and try again.', 'error');
  }

  if (!problemData?.title && !problemData?.description) {
    return showStatus('Problem content not found. Try refreshing.', 'error');
  }

  showLoading(true);
  output.classList.add('hidden');

  const prompt = buildPrompt(problemData);

  try {
    const questions = await callGemini(geminiApiKey, prompt);
    renderQuestions(problemData.title, questions);
  } catch (err) {
    showStatus('Gemini error: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
});

function buildPrompt({ title, description }) {
  return `You are a senior FAANG interviewer. Given this LeetCode problem, generate 6 insightful follow-up questions that would be asked in a real interview to test deeper understanding.

Problem Title: ${title}

Problem Description:
${description}

Generate exactly 6 follow-up questions. Each should probe:
- Edge cases / constraints
- Time & space complexity tradeoffs
- Alternative approaches
- Real-world application
- Scalability
- Optimization

Format your response as a numbered list only. No preamble or explanation.`;
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || 'API request failed');
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseQuestions(text);
}

function parseQuestions(text) {
  return text
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(line => line.length > 10);
}

function renderQuestions(title, questions) {
  problemTitle.textContent = title || 'Problem';
  questionsList.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    questionsList.appendChild(li);
  });
  output.classList.remove('hidden');
}

function showStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className = `status ${type}`;
  statusBar.classList.remove('hidden');
  setTimeout(() => statusBar.classList.add('hidden'), 3500);
}

function showLoading(show) {
  loading.classList.toggle('hidden', !show);
  generateBtn.disabled = show;
}
