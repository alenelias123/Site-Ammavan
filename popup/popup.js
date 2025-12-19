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
// We'll inject a script that listens and then uses window.postMessage to send to extension
await chrome.scripting.executeScript({
target: {tabId: tab.id},
func: () => {
const relHandler = (ev) => {
// send the results to the extension via window.postMessage
window.postMessage({source: 'siteTechInspector', results: ev.detail.results}, '*');
window.removeEventListener('SiteTechInspectResult', relHandler);
};
window.addEventListener('SiteTechInspectResult', relHandler);
}
});


// listen for message from the page
function pageMessageHandler(ev) {
if (ev.source !== window) return; // only same-window
const data = ev.data;
if (data && data.source === 'siteTechInspector') {
lastResults = data.results || [];
renderResults(lastResults);
status.textContent = `Found ${lastResults.length} technology(ies)`;
window.removeEventListener('message', pageMessageHandler);
}
}


window.addEventListener('message', pageMessageHandler);


};