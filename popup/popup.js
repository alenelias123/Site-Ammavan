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
    resultsList.innerHTML = '<li>🤷 No technologies detected.</li>';
    return;
  }
  
  results.forEach(tech => {
    const li = document.createElement('li');
    const icon = getTechIcon(tech.name, tech.category);
    li.textContent = `${icon} ${tech.name}${tech.category ? ` (${tech.category})` : ''}`;
    resultsList.appendChild(li);
  });
}

// Get icon for technology
function getTechIcon(name, category) {
  const lowerName = name.toLowerCase();
  
  // Frameworks
  if (lowerName.includes('react')) return '⚛️';
  if (lowerName.includes('vue')) return '💚';
  if (lowerName.includes('angular')) return '🅰️';
  if (lowerName.includes('svelte')) return '🔥';
  
  // Libraries
  if (lowerName.includes('jquery')) return '📜';
  
  // CMS
  if (lowerName.includes('wordpress')) return '📝';
  
  // Analytics
  if (lowerName.includes('analytics')) return '📊';
  if (lowerName.includes('tracking')) return '👁️';
  
  // Default by category
  if (category && category.toLowerCase().includes('framework')) return '🏗️';
  if (category && category.toLowerCase().includes('library')) return '📚';
  
  return '🔧';
}

// Function to render infrastructure/hosting info in the UI
function renderInfrastructure(infraInfo) {
  infraList.innerHTML = '';
  if (!infraInfo) {
    const noInfoLi = document.createElement('li');
    noInfoLi.textContent = '🤷 No infrastructure detected.';
    infraList.appendChild(noInfoLi);
    return;
  }
  
  // Display server info (using textContent to prevent XSS)
  if (infraInfo.server && infraInfo.server !== 'Unknown') {
    const serverLi = document.createElement('li');
    const serverIcon = getInfraIcon(infraInfo.server, 'server');
    serverLi.textContent = `${serverIcon} Server: ${infraInfo.server}`;
    infraList.appendChild(serverLi);
  }
  
  // Display infrastructure platforms (using textContent to prevent XSS)
  if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    infraInfo.infrastructure.forEach(platform => {
      const li = document.createElement('li');
      const infraIcon = getInfraIcon(platform, 'platform');
      li.textContent = `${infraIcon} Hosting/CDN: ${platform}`;
      infraList.appendChild(li);
    });
  }
  
  // Display security headers with icons
  if (infraInfo.securityHeaders) {
    const secHeaders = infraInfo.securityHeaders;
    const securityLi = document.createElement('li');
    const secureCount = Object.values(secHeaders).filter(Boolean).length;
    const securityIcon = secureCount >= 3 ? '🛡️' : secureCount >= 1 ? '🔒' : '⚠️';
    securityLi.textContent = `${securityIcon} Security Headers: ${secureCount}/4 present`;
    infraList.appendChild(securityLi);
  }
  
  // If nothing detected
  if ((!infraInfo.server || infraInfo.server === 'Unknown') && 
      (!infraInfo.infrastructure || infraInfo.infrastructure.length === 0)) {
    const noDetectionLi = document.createElement('li');
    noDetectionLi.textContent = '🤷 No infrastructure detected.';
    infraList.appendChild(noDetectionLi);
  }
}

// Get icon for infrastructure
function getInfraIcon(name, type) {
  const lowerName = name.toLowerCase();
  
  if (type === 'server') {
    if (lowerName.includes('nginx')) return '🟢';
    if (lowerName.includes('apache')) return '🪶';
    if (lowerName.includes('cloudflare')) return '☁️';
    return '🖥️';
  }
  
  // Platform/CDN icons
  if (lowerName.includes('cloudflare')) return '☁️';
  if (lowerName.includes('vercel')) return '▲';
  if (lowerName.includes('netlify')) return '💎';
  if (lowerName.includes('aws') || lowerName.includes('amazon')) return '☁️';
  if (lowerName.includes('azure')) return '☁️';
  if (lowerName.includes('google cloud') || lowerName.includes('gcp')) return '☁️';
  if (lowerName.includes('github')) return '🐙';
  if (lowerName.includes('heroku')) return '💜';
  if (lowerName.includes('digitalocean')) return '🌊';
  
  return '🌐';
}

// Generate "Ammavan Verdict" - a one-liner judgment with proper Mallu ammavan sass
function generateVerdict(technologies, infraInfo) {
  const parts = [];
  
  // Check for modern frameworks with sarcasm
  const frameworks = technologies.filter(t => t.category === 'javascript framework');
  if (frameworks.length > 0) {
    const frameworkName = frameworks[0].name;
    if (frameworkName === 'React') {
      parts.push('Alleyo makane, React aano use cheyyunne! (Probably showing off at parties)');
    } else if (frameworkName === 'Angular') {
      parts.push('Angular! TypeScript fanboy spotted');
    } else if (frameworkName === 'Vue') {
      parts.push(`${frameworkName} site (pragmatic, like our neighbour Raju)`);
    } else {
      parts.push(`${frameworkName} framework kandu (trying to be modern)`);
    }
  } else if (technologies.some(t => t.name === 'jQuery')) {
    parts.push('Ayyo! jQuery in 2024? Time machine-il ninnu vannathaano?');
  } else if (technologies.some(t => t.name === 'WordPress')) {
    parts.push('WordPress! Like every second website these days');
  } else {
    parts.push('Plain vanilla site (minimalist or lazy? You decide)');
  }
  
  // Check for CDN/hiding with sass
  if (infraInfo.infrastructure && infraInfo.infrastructure.includes('Cloudflare')) {
    parts.push('Cloudflare-ine vishwasikall mwonee!! pani kittum! (Smart, but we still found you)');
  } else if (infraInfo.infrastructure && infraInfo.infrastructure.some(i => i.includes('Vercel'))) {
    parts.push('Vercel-il deploy cheythu! Next.js fanboy aanenno?');
  } else if (infraInfo.infrastructure && infraInfo.infrastructure.some(i => i.includes('Netlify'))) {
    parts.push('Netlify use cheyyunnu (JAMstack enthusiast pretending to be cool)');
  } else if (infraInfo.infrastructure && infraInfo.infrastructure.some(i => i.includes('GitHub Pages'))) {
    parts.push('GitHub Pages-il! Free hosting is best hosting, alle? Vello panik poi 2 cash ondak mwonee!');
  } else if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    parts.push(`${infraInfo.infrastructure[0]} kandu`);
  }
  
  // Security assessment with proper Malayalam uncle style
  const secHeaders = infraInfo.securityHeaders || {};
  const secureCount = Object.values(secHeaders).filter(Boolean).length;
  
  if (secureCount >= 3) {
    parts.push('Security nannayitt und (Finally, someone who cares!)');
  } else if (secureCount >= 1) {
    parts.push('Security okke... (Could be worse, could be better)');
  } else {
    parts.push('Security? Athennathada uvve? (What security? Hackers will have a party!)');
  }
  
  return parts.join(' ');
}

// Generate "Ammavan Findings" - non-obvious discoveries with proper sass
function generateFindings(technologies, infraInfo) {
  const findings = [];
  
  // Technology-specific findings with Mallu ammavan style
  technologies.forEach(tech => {
    if (tech.name === 'React') {
      findings.push('💰 React kandu! Probably over-engineered like Sharma uncle\'s house');
    } else if (tech.name === 'Angular') {
      findings.push('🅰️ Angular use cheyyunnu! TypeScript addict aanenno?');
    } else if (tech.name === 'Vue') {
      findings.push('💚 Vue spotted! Smart choice machane, not too heavy, not too light');
    } else if (tech.name === 'jQuery') {
      findings.push('📜 jQuery in 2024?! Pazhaya kalath ninnu vannathaano? (Did you come from the old days?)');
    } else if (tech.name === 'WordPress') {
      findings.push('📝 WordPress! Like 43% of internet. Original alle? (Very original!)');
    } else if (tech.name === 'Google Analytics (gtag.js)' || tech.name.includes('Analytics')) {
      findings.push('👁️ Google Analytics kandu! Your data is their business, literally');
    }
  });
  
  // Infrastructure findings with sass
  if (infraInfo.infrastructure && infraInfo.infrastructure.length > 0) {
    infraInfo.infrastructure.forEach(provider => {
      if (provider === 'Cloudflare') {
        findings.push('☁️ Cloudflare-inte pinnil hide cheyunno! (Smart move, but still found you)');
      } else if (provider === 'Vercel') {
        findings.push('▲ Vercel-il host cheyyunnu! Next.js dev spotted in the wild');
      } else if (provider === 'Netlify') {
        findings.push('💎 Netlify! JAMstack fanboy aanalle? (Fancy!)');
      } else if (provider === 'AWS') {
        findings.push('☁️ AWS-il! Cloud bills kandaal heart attack varum (Those bills though!)');
      } else if (provider === 'GitHub Pages') {
        findings.push('🐙 GitHub Pages! Free hosting best hosting, alle? Budget developer spotted!');
      } else if (provider === 'Heroku') {
        findings.push('💜 Heroku! Sleep cheyyunna dyno! Wake up kodukkendey? (Sleeping dynos, anyone?)');
      }
    });
  }
  
  // Security header findings with proper roasting
  const secHeaders = infraInfo.securityHeaders || {};
  if (!secHeaders.csp) {
    findings.push('⚠️ No CSP header! XSS attacks-inu open invitation aanallo!');
  }
  if (!secHeaders.xFrameOptions) {
    findings.push('⚠️ No X-Frame-Options! Clickjacking-inu ready aano? (Ready for clickjacking?)');
  }
  if (!secHeaders.strictTransportSecurity) {
    findings.push('⚠️ No HSTS! HTTP-il vannal enth cheyum machane! (What if someone uses HTTP?)');
  }
  if (secHeaders.csp && secHeaders.xFrameOptions && secHeaders.strictTransportSecurity) {
    findings.push('🛡️ Good security headers present! Finally, someone who studied security!');
  }
  
  // Server findings with commentary
  if (infraInfo.server && infraInfo.server !== 'Unknown') {
    if (infraInfo.server.toLowerCase().includes('nginx')) {
      findings.push('🟢 nginx server! Popular choice, like idli for breakfast');
    } else if (infraInfo.server.toLowerCase().includes('apache')) {
      findings.push('🪶 Apache server! Classic choice, like our old Ambassador car');
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
      li.textContent = '😴 Nothing interesting found (boring site, like watching paint dry)';
      findingsList.appendChild(li);
    } else {
      findings.forEach(finding => {
        const li = document.createElement('li');
        li.textContent = finding;
        findingsList.appendChild(li);
      });
    }
  }
}


// Helper function to calculate security rating
function getSecurityRating(infraInfo) {
  if (!infraInfo?.securityHeaders) return "🤷 Unknown (Probably not good!)";
  const secureCount = Object.values(infraInfo.securityHeaders).filter(Boolean).length;
  if (secureCount >= 3) return "😎 Not bad at all! (Someone studied!)";
  if (secureCount >= 1) return "😐 Could be worse... could be better";
  return "😬 Yikes! (Hackers rejoicing!)";
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
    ammavan_says: "☕ Ayyo, ini oru site-inte kadha kelkkam! (Let me tell you about this website...)",
    verdict: verdict,
    findings: findings,
    technologies: lastResults,
    infrastructure: lastInfraInfo || DEFAULT_INFRA_INFO,
    gossip_level: findings.length > 5 ? "Maximum (Ammavan can't stop talking!)" : findings.length > 3 ? "High (Juicy details!)" : "Moderate (Decent gossip)",
    ammavan_rating: {
      security: getSecurityRating(lastInfraInfo),
      modernity: lastResults.some(t => ['React', 'Vue', 'Angular', 'Svelte'].includes(t.name)) ? 
        "🚀 Living in 2024 (High-tech machane!)" : 
        lastResults.some(t => t.name === 'jQuery') ? 
          "🦖 Dinosaur vibes (Pazhaya kalam!)" : 
          "📜 Keeping it simple (or lazy?)",
      privacy: lastResults.some(t => t.name.includes('Analytics')) ? 
        "👀 They're watching you (Big Brother style!)" : 
        "🤫 Respectful... for now (Don't trust them fully)"
    },
    disclaimer: "☕ This report is brought to you by your friendly neighbourhood Ammavan. Ith ellam gossip maathram aanu! Take it with a pinch of salt and a cup of chai. Not responsible for hurt feelings! 😄"
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