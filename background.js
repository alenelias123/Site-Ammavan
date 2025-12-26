const SERVER_HEADERS = ["server", "x-powered-by", "x-generator"];

const INFRA_SIGNATURES = [
  { name: "Cloudflare", regex: /cloudflare/i },
  { name: "Akamai", regex: /akamai/i },
  { name: "Fastly", regex: /fastly/i },
  { name: "Vercel", regex: /vercel/i },
  { name: "Netlify", regex: /netlify/i },
  { name: "AWS", regex: /amazon|aws/i }
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

      for (const sig of INFRA_SIGNATURES) {
        if (sig.regex.test(value)) {
          infra.add(sig.name);
        }
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
