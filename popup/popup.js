const scanBtn = document.getElementById('scanBtn');
const status = document.getElementById('status');
const resultsList = document.getElementById('results');
const exportBtn = document.getElementById('exportBtn');
let lastResults = [];


scanBtn.onclick = async () => {
status.textContent = 'Scanning...';
resultsList.innerHTML = '';


// fetch signatures from background
const sigs = await new Promise(resolve => {
chrome.runtime.sendMessage({type: 'getSignatures'}, resp => resolve(resp.signatures || []));
});


// Inject the detector script (content_scripts/detect.js) into the active tab
const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
if (!tab || !tab.id) { status.textContent = 'No active tab.'; return; }


// inject content script source file
await chrome.scripting.executeScript({
target: {tabId: tab.id},
files: ['content_scripts/detect.js']
});


// send signatures into page via custom event
await chrome.scripting.executeScript({
target: {tabId: tab.id},
func: (sigs) => {
window.dispatchEvent(new CustomEvent('SiteTechInspect', {detail:{signatures: sigs}}));
},
args: [sigs]
});


// wait for result from page by listening in the extension (we inject a one-time listener)
// We'll inject a script that listens and then uses chrome.runtime.sendMessage to send to extension
await chrome.scripting.executeScript({
target: {tabId: tab.id},
func: () => {
const relHandler = (ev) => {
// send the results to the extension via chrome.runtime.sendMessage
chrome.runtime.sendMessage({
type: 'DETECTION_RESULT',
results: ev.detail.results
});
window.removeEventListener('SiteTechInspectResult', relHandler);
};
window.addEventListener('SiteTechInspectResult', relHandler);
}
});


// listen for message from the content script
const messageListener = (message) => {
if (message && message.type === 'DETECTION_RESULT') {
lastResults = message.results || [];
renderResults(lastResults);
status.textContent = `Found ${lastResults.length} technology(ies)`;
chrome.runtime.onMessage.removeListener(messageListener);
}
};

chrome.runtime.onMessage.addListener(messageListener);


};


// Function to render results in the UI
function renderResults(results) {
  resultsList.innerHTML = '';
  if (!results || results.length === 0) {
    resultsList.innerHTML = '<li>No technologies detected.</li>';
    return;
  }
  
  results.forEach(tech => {
    const li = document.createElement('li');
    li.textContent = `${tech.name}${tech.category ? ` (${tech.category})` : ''}`;
    resultsList.appendChild(li);
  });
}


// Export button handler
exportBtn.onclick = () => {
  if (!lastResults || lastResults.length === 0) {
    alert('No results to export. Please scan a page first.');
    return;
  }
  
  const json = JSON.stringify(lastResults, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-technologies.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
};