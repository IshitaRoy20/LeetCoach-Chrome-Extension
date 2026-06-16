function extractProblemData() {
  const titleEl = document.querySelector('[data-cy="question-title"]')
    || document.querySelector('div[class*="title"] h4')
    || document.querySelector('h4.text-title-large');

  const descEl = document.querySelector('[data-track-load="description_content"]')
    || document.querySelector('div[class*="description"]');

  const title = titleEl?.innerText?.trim() || '';
  const description = descEl?.innerText?.trim().slice(0, 2000) || ''; // cap at 2000 chars

  return { title, description };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProblemData') {
    const data = extractProblemData();
    sendResponse(data);
  }
});
