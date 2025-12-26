const SERVER_HEADERS = ["server", "x-powered-by", "x-generator"];

const DEFAULT_INFRA_INFO = {
  server: "Unknown",
  infrastructure: [],
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
        }
      }
      
      // Additional specific header checks for better detection
      if (name.includes('cf-') || name === 'cf-ray') {
        infra.add('Cloudflare');
      }
      if (name.includes('x-vercel-') || name === 'x-vercel-id') {
        infra.add('Vercel');
      }
      if (name.includes('x-nf-') || name === 'x-nf-request-id') {
        infra.add('Netlify');
      }
      if (name.includes('x-amz-') || name === 'x-amz-cf-id') {
        infra.add('AWS');
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
