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
  infrastructure: [],
  securityHeaders: {
    csp: false,
    xFrameOptions: false,
    strictTransportSecurity: false,
    xContentTypeOptions: false
  }
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
console.error('Error fetching infrastructure info:', chrome.runtime.lastError.message);
lastInfraInfo = DEFAULT_INFRA_INFO;
} else {
lastInfraInfo = infraInfo || DEFAULT_INFRA_INFO;
}
renderInfrastructure(lastInfraInfo);

// Generate and render Ammavan Verdict and Findings
const verdict = generateVerdict(lastResults, lastInfraInfo);
const findings = generateFindings(lastResults, lastInfraInfo);
renderVerdict(verdict);
renderFindings(findings);
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

// Generate "Ammavan Verdict" - a one-liner judgment
function generateVerdict(technologies, infraInfo) {
  const parts = [];
  
  // Check for modern frameworks
  const frameworks = technologies.filter(t => t.category === 'javascript framework');
  if (frameworks.length > 0) {
    const frameworkName = frameworks[0].name;
    parts.push(`Modern ${frameworkName} site`);
  } else if (technologies.some(t => t.name === 'jQuery')) {
    parts.push('Old-school jQuery site');
  } else if (technologies.some(t => t.name === 'WordPress')) {
    parts.push('WordPress-powered site');
  } else {
    parts.push('Simple site');
  }
  
  // Check for CDN/hiding
  if (infraInfo.infrastructure && infraInfo.infrastructure.includes('Cloudflare')) {
    parts.push('hiding behind Cloudflare');
  } else if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    parts.push(`using ${infraInfo.infrastructure[0]}`);
  }
  
  // Security assessment
  const secHeaders = infraInfo.securityHeaders || {};
  const secureCount = Object.values(secHeaders).filter(Boolean).length;
  
  if (secureCount >= 3) {
    parts.push('Well secured');
  } else if (secureCount >= 1) {
    parts.push('Decently secured');
  } else {
    parts.push('Security needs work');
  }
  
  return parts.join('. ') + '.';
}

// Generate "Ammavan Findings" - non-obvious discoveries
function generateFindings(technologies, infraInfo) {
  const findings = [];
  
  // Technology-specific findings
  technologies.forEach(tech => {
    if (tech.name === 'React') {
      findings.push('Site uses React (probably over-engineered for what it does)');
    } else if (tech.name === 'Angular') {
      findings.push('Site uses Angular (someone likes TypeScript)');
    } else if (tech.name === 'Vue') {
      findings.push('Site uses Vue (good choice, pragmatic devs)');
    } else if (tech.name === 'WordPress') {
      findings.push('WordPress detected (along with 43% of the internet)');
    } else if (tech.name === 'Google Analytics (gtag.js)') {
      findings.push('Google Analytics present (your data is being collected)');
    }
  });
  
  // Infrastructure findings
  if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    infraInfo.infrastructure.forEach(provider => {
      if (provider === 'Cloudflare') {
        findings.push('Hides server using Cloudflare (smart move)');
      } else if (provider === 'Vercel') {
        findings.push('Hosted on Vercel (Next.js vibes detected)');
      } else if (provider === 'Netlify') {
        findings.push('Hosted on Netlify (JAMstack enthusiast spotted)');
      } else if (provider === 'AWS') {
        findings.push('Running on AWS (cloud bills must be fun)');
      } else if (provider === 'GitHub Pages') {
        findings.push('Hosted on GitHub Pages (free hosting FTW)');
      }
    });
  }
  
  // Security header findings
  const secHeaders = infraInfo.securityHeaders || {};
  if (!secHeaders.csp) {
    findings.push('No CSP header (risky - XSS attacks welcome)');
  }
  if (!secHeaders.xFrameOptions) {
    findings.push('No X-Frame-Options (clickjacking possible)');
  }
  if (!secHeaders.strictTransportSecurity) {
    findings.push('No HSTS header (not forcing HTTPS)');
  }
  if (secHeaders.csp && secHeaders.xFrameOptions && secHeaders.strictTransportSecurity) {
    findings.push('Good security headers present (devs actually care)');
  }
  
  // Server findings
  if (infraInfo.server && infraInfo.server !== 'Unknown') {
    if (infraInfo.server.toLowerCase().includes('nginx')) {
      findings.push('nginx server (popular choice)');
    } else if (infraInfo.server.toLowerCase().includes('apache')) {
      findings.push('Apache server (classic)');
    }
  }
  
  return findings;
}

// Render verdict
function renderVerdict(verdict) {
  const verdictDiv = document.getElementById('verdict');
  if (verdictDiv) {
    verdictDiv.textContent = verdict;
  }
}

// Render findings
function renderFindings(findings) {
  const findingsList = document.getElementById('findings');
  if (findingsList) {
    findingsList.innerHTML = '';
    if (findings.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nothing interesting found (boring site)';
      findingsList.appendChild(li);
    } else {
      findings.forEach(finding => {
        const li = document.createElement('li');
        li.textContent = '• ' + finding;
        findingsList.appendChild(li);
      });
    }
  }
}


// Helper function to calculate security rating
function getSecurityRating(infraInfo) {
  if (!infraInfo?.securityHeaders) return "🤷 Unknown";
  const secureCount = Object.values(infraInfo.securityHeaders).filter(Boolean).length;
  if (secureCount >= 3) return "😎 Not bad";
  if (secureCount >= 1) return "😐 Could be worse";
  return "😬 Yikes";
}

// Export button handler
exportBtn.onclick = () => {
  if (!lastResults || lastResults.length === 0) {
    alert('No results to export. Please scan a page first.');
    return;
  }
  
  const verdict = generateVerdict(lastResults, lastInfraInfo || DEFAULT_INFRA_INFO);
  const findings = generateFindings(lastResults, lastInfraInfo || DEFAULT_INFRA_INFO);
  
  const exportData = {
    ammavan_says: "☕ Well well well, look what we have here...",
    verdict: verdict,
    findings: findings,
    technologies: lastResults,
    infrastructure: lastInfraInfo || DEFAULT_INFRA_INFO,
    gossip_level: findings.length > 5 ? "Maximum" : findings.length > 3 ? "High" : "Moderate",
    ammavan_rating: {
      security: getSecurityRating(lastInfraInfo),
      modernity: lastResults.some(t => ['React', 'Vue', 'Angular'].includes(t.name)) ? 
        "🚀 Living in 2024" : 
        lastResults.some(t => t.name === 'jQuery') ? 
          "🦖 Dinosaur vibes" : 
          "📜 Keeping it simple",
      privacy: lastResults.some(t => t.name.includes('Analytics')) ? 
        "👀 They're watching" : 
        "🤫 Respectful (for now)"
    },
    disclaimer: "This report is brought to you by your friendly neighbourhood Ammavan. Take it with a pinch of salt (and a cup of chai). ☕"
  };
  
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ammavan-gossip-report.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
};