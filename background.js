const SERVER_HEADERS = ["server", "x-powered-by", "x-generator"];

const INFRA_SIGNATURES = [
  { name: "Cloudflare", regex: /cloudflare/i },
  { name: "Akamai", regex: /akamai/i },
  { name: "Fastly", regex: /fastly/i },
  { name: "Vercel", regex: /vercel/i },
  { name: "Netlify", regex: /netlify/i },
  { name: "AWS", regex: /amazon|aws/i },
  { name: "Google Cloud", regex: /gcp|google/i },
  { name: "Azure", regex: /azure|microsoft/i },
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

    for (const h of headers) {
      const name = h.name.toLowerCase();
      const value = h.value || "";

      if (SERVER_HEADERS.includes(name) && !server) {
        server = value;
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

    tabScanCache[details.tabId] = {
      server: server || "Unknown",
      infrastructure: Array.from(infra)
    };
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SERVER_INFO") {
    sendResponse(tabScanCache[msg.tabId] || {
      server: "Unknown",
      infrastructure: []
    });
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
