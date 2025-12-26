const scanBtn = document.getElementById('scanBtn');
const status = document.getElementById('status');
const resultsList = document.getElementById('results');
const infraList = document.getElementById('infrastructure');
const exportBtn = document.getElementById('exportBtn');
let lastResults = [];
let lastInfraInfo = null;
let isScanning = false;

const DEFAULT_INFRA_INFO = {
  server: 'Unknown',
  infrastructure: []
};


scanBtn.onclick = async () => {
if (isScanning) {
status.textContent = 'Scan already in progress...';
return;
}
isScanning = true;
status.textContent = 'Scanning...';
resultsList.innerHTML = '';
infraList.innerHTML = '';

let timeoutId = null;

try {
// fetch signatures from background
const sigs = await new Promise((resolve, reject) => {
chrome.runtime.sendMessage({type: 'getSignatures'}, resp => {
if (chrome.runtime.lastError) {
reject(chrome.runtime.lastError.message);
} else {
resolve(resp?.signatures || []);
}
});
});


// Inject the detector script (content_scripts/detect.js) into the active tab
const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
if (!tab || !tab.id) { 
status.textContent = 'No active tab.'; 
isScanning = false;
return; 
}


// inject content script source file
await chrome.scripting.executeScript({
target: {tabId: tab.id},
files: ['content_scripts/detect.js']
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
const messageListener = (message, sender) => {
// Validate sender to ensure message comes from the expected tab
if (message && message.type === 'DETECTION_RESULT' && sender.tab && sender.tab.id === tab.id) {
lastResults = message.results || [];
renderResults(lastResults);

// Also fetch infrastructure info
chrome.runtime.sendMessage({type: 'GET_SERVER_INFO', tabId: tab.id}, (infraInfo) => {
if (chrome.runtime.lastError) {
console.error('Error fetching infrastructure info:', chrome.runtime.lastError);
lastInfraInfo = DEFAULT_INFRA_INFO;
} else {
lastInfraInfo = infraInfo || DEFAULT_INFRA_INFO;
}
renderInfrastructure(lastInfraInfo);
});

status.textContent = `Found ${lastResults.length} technology(ies)`;
isScanning = false;
chrome.runtime.onMessage.removeListener(messageListener);
if (timeoutId) clearTimeout(timeoutId);
}
};

chrome.runtime.onMessage.addListener(messageListener);


// send signatures into page via custom event (do this AFTER listeners are set up)
await chrome.scripting.executeScript({
target: {tabId: tab.id},
func: (sigs) => {
window.dispatchEvent(new CustomEvent('SiteTechInspect', {detail:{signatures: sigs}}));
},
args: [sigs]
});


// Set a timeout in case the scan never completes
timeoutId = setTimeout(() => {
if (isScanning) {
status.textContent = 'Scan timeout - please try again';
isScanning = false;
chrome.runtime.onMessage.removeListener(messageListener);
}
}, 10000); // 10 second timeout

} catch (error) {
console.error('Scan error:', error);
status.textContent = 'Error during scan - please try again';
isScanning = false;
if (timeoutId) clearTimeout(timeoutId);
}

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

// Function to render infrastructure/hosting info in the UI
function renderInfrastructure(infraInfo) {
  infraList.innerHTML = '';
  if (!infraInfo) {
    const noInfoLi = document.createElement('li');
    noInfoLi.textContent = 'No infrastructure detected.';
    infraList.appendChild(noInfoLi);
    return;
  }
  
  // Display server info (using textContent to prevent XSS)
  if (infraInfo.server && infraInfo.server !== 'Unknown') {
    const serverLi = document.createElement('li');
    const serverLabel = document.createElement('strong');
    serverLabel.textContent = 'Server: ';
    serverLi.appendChild(serverLabel);
    serverLi.appendChild(document.createTextNode(infraInfo.server));
    infraList.appendChild(serverLi);
  }
  
  // Display infrastructure platforms (using textContent to prevent XSS)
  if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    infraInfo.infrastructure.forEach(platform => {
      const li = document.createElement('li');
      const platformLabel = document.createElement('strong');
      platformLabel.textContent = 'Hosting/CDN: ';
      li.appendChild(platformLabel);
      li.appendChild(document.createTextNode(platform));
      infraList.appendChild(li);
    });
  }
  
  // If nothing detected
  if ((!infraInfo.server || infraInfo.server === 'Unknown') && 
      (!infraInfo.infrastructure || infraInfo.infrastructure.length === 0)) {
    const noDetectionLi = document.createElement('li');
    noDetectionLi.textContent = 'No infrastructure detected.';
    infraList.appendChild(noDetectionLi);
  }
}


// Export button handler
exportBtn.onclick = () => {
  if (!lastResults || lastResults.length === 0) {
    alert('No results to export. Please scan a page first.');
    return;
  }
  
  const exportData = {
    technologies: lastResults,
    infrastructure: lastInfraInfo || DEFAULT_INFRA_INFO
  };
  
  const json = JSON.stringify(exportData, null, 2);
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