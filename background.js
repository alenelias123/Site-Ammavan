chrome.runtime.onInstalled.addListener(async () => {
// Load default signatures
try {
const resp = await fetch(chrome.runtime.getURL('data/signatures.json'));
const sigs = await resp.json();
chrome.storage.local.set({signatures: sigs});
} catch (error) {
console.error('Failed to load signatures:', error);
// Set empty array as fallback
chrome.storage.local.set({signatures: []});
}
});


// simple message pass-through
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message && message.type === 'getSignatures') {
chrome.storage.local.get('signatures', data => {
sendResponse({signatures: data.signatures || []});
});
return true; // indicates async response
}
});