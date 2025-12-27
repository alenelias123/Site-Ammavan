const SERVER_HEADERS = ["server", "x-powered-by", "x-generator"];

const DEFAULT_INFRA_INFO = {
  server: "Unknown",
  infrastructure: [],
  infrastructureWithConfidence: [],
  securityHeaders: {
    csp: false,
    xFrameOptions: false,
    strictTransportSecurity: false,
    xContentTypeOptions: false
  }
};

const INFRA_SIGNATURES = [
  { name: "Cloudflare", regex: /cloudflare/i },
  { name: "Akamai", regex: /akamai/i },
  { name: "Fastly", regex: /fastly/i },
  { name: "Vercel", regex: /vercel/i },
  { name: "Netlify", regex: /netlify/i },
  { name: "AWS", regex: /amazon|aws|cloudfront/i },
  { name: "Google Cloud", regex: /gcp|googlecloud|google-cloud/i },
  { name: "Azure", regex: /azure|azurewebsites|azure-/i },
  { name: "Heroku", regex: /heroku/i },
  { name: "DigitalOcean", regex: /digitalocean/i },
  { name: "GitHub Pages", regex: /github\.io|pages\.github/i },
  { name: "Firebase", regex: /firebase/i }
];

const tabScanCache = {};

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    const headers = details.responseHeaders || [];
    let server = null;
    const infra = new Set();
    const infraConfidence = {}; // Track confidence scores
    const securityHeaders = {
      csp: false,
      xFrameOptions: false,
      strictTransportSecurity: false,
      xContentTypeOptions: false
    };

    for (const h of headers) {
      const name = h.name.toLowerCase();
      const value = h.value || "";

      if (SERVER_HEADERS.includes(name) && !server) {
        server = value;
      }

      // Check for security headers
      if (name === 'content-security-policy') {
        securityHeaders.csp = true;
      }
      if (name === 'x-frame-options') {
        securityHeaders.xFrameOptions = true;
      }
      if (name === 'strict-transport-security') {
        securityHeaders.strictTransportSecurity = true;
      }
      if (name === 'x-content-type-options') {
        securityHeaders.xContentTypeOptions = true;
      }

      // Check both header names and values for infrastructure signatures
      for (const sig of INFRA_SIGNATURES) {
        if (sig.regex.test(value) || sig.regex.test(name)) {
          infra.add(sig.name);
          infraConfidence[sig.name] = (infraConfidence[sig.name] || 0) + 1;
        }
      }
      
      // Additional specific header checks for better detection
      if (name.includes('cf-') || name === 'cf-ray') {
        infra.add('Cloudflare');
        infraConfidence['Cloudflare'] = (infraConfidence['Cloudflare'] || 0) + 2; // Higher weight for specific headers
      }
      if (name.includes('x-vercel-') || name === 'x-vercel-id') {
        infra.add('Vercel');
        infraConfidence['Vercel'] = (infraConfidence['Vercel'] || 0) + 2;
      }
      if (name.includes('x-nf-') || name === 'x-nf-request-id') {
        infra.add('Netlify');
        infraConfidence['Netlify'] = (infraConfidence['Netlify'] || 0) + 2;
      }
      if (name.includes('x-amz-') || name === 'x-amz-cf-id') {
        infra.add('AWS');
        infraConfidence['AWS'] = (infraConfidence['AWS'] || 0) + 2;
      }
    }

    // Get existing cache or create new entry
    let existing;
    if (tabScanCache[details.tabId]) {
      existing = tabScanCache[details.tabId];
    } else {
      // Only spread when we actually need a new object
      existing = { ...DEFAULT_INFRA_INFO };
    }

    // Update server if we found one and don't have one yet
    if (server && existing.server === "Unknown") {
      existing.server = server;
    }

    // Merge infrastructure detections (accumulate across requests)
    const mergedInfra = new Set([...existing.infrastructure, ...infra]);
    
    // Merge confidence scores (accumulate scores)
    const mergedConfidence = { ...(existing.infraConfidence || {}) };
    for (const [provider, score] of Object.entries(infraConfidence)) {
      mergedConfidence[provider] = (mergedConfidence[provider] || 0) + score;
    }
    
    // Convert to array with confidence percentages
    // Higher confidence = more headers matched
    // Max realistic score is around 10 (multiple specific headers found)
    const infrastructureWithConfidence = Array.from(mergedInfra).map(provider => {
      const rawScore = mergedConfidence[provider] || 1;
      // Cap percentage at 95% to avoid overconfidence, minimum at 40% for any detection
      const percentage = Math.min(95, Math.max(40, 30 + (rawScore * 10)));
      return {
        name: provider,
        confidence: Math.round(percentage)
      };
    }).sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending
    
    // Merge security headers (keep true values)
    const mergedSecurityHeaders = {
      csp: existing.securityHeaders.csp || securityHeaders.csp,
      xFrameOptions: existing.securityHeaders.xFrameOptions || securityHeaders.xFrameOptions,
      strictTransportSecurity: existing.securityHeaders.strictTransportSecurity || securityHeaders.strictTransportSecurity,
      xContentTypeOptions: existing.securityHeaders.xContentTypeOptions || securityHeaders.xContentTypeOptions
    };
    
    tabScanCache[details.tabId] = {
      server: existing.server,
      infrastructure: Array.from(mergedInfra),
      infrastructureWithConfidence: infrastructureWithConfidence,
      infraConfidence: mergedConfidence,
      securityHeaders: mergedSecurityHeaders
    };
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SERVER_INFO") {
    sendResponse(tabScanCache[msg.tabId] || DEFAULT_INFRA_INFO);
  } else if (msg.type === "getSignatures") {
    fetch(chrome.runtime.getURL("data/signatures.json"))
      .then(r => r.json())
      .then(signatures => sendResponse({ signatures }))
      .catch(err => {
        console.error("Failed to load signatures:", err);
        sendResponse({ signatures: [] });
      });
    return true; // Keep channel open for async response
  }
});

// Clean up cache when tabs are closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabScanCache[tabId];
});
