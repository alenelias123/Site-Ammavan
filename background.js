chrome.runtime.onInstalled.addListener(async () => {
// Load default signatures
const resp = await fetch(chrome.runtime.getURL('data/signatures.json'));
const sigs = await resp.json();
chrome.storage.local.set({signatures: sigs});
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