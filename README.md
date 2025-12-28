# Site Ammavan - Browser Extension

A Chrome extension that detects technologies, frameworks, and infrastructure used by websites - just like the neighbourhood ammavan (gossiper) peeks into your life!

## Features

### Ammavan Verdict 
Get a witty, one-line judgment about the website you're scanning. The neighbourhood Ammavan always has an opinion!
- **Examples**: "Modern React site hiding behind Cloudflare. Decently secured." or "Old-school jQuery site. Security needs work."

### Ammavan Findings 
Discover non-obvious insights about the site's technology and security:
- Technology observations (e.g., "Site uses React (probably over-engineered for what it does)")
- Security findings (e.g., "No CSP header (risky - XSS attacks welcome)")
- Infrastructure insights (e.g., "Hides server using Cloudflare (smart move)")
- Privacy notices (e.g., "Google Analytics present (your data is being collected)")

### Technology Detection
Automatically detects common web technologies including:
- JavaScript frameworks (React, Angular, Vue, Svelte)
- JavaScript libraries (jQuery)
- Content Management Systems (WordPress)
- Analytics tools (Google Analytics)

### Infrastructure Detection
Identifies hosting providers and infrastructure services through HTTP header analysis with confidence percentages:
- **CDN Providers**: Cloudflare, Akamai, Fastly
- **Cloud Platforms**: AWS, Google Cloud, Azure
- **PaaS Providers**: Vercel, Netlify, Heroku
- **Other Services**: GitHub Pages, Firebase, DigitalOcean
- **Confidence Scoring**: Each detection now includes a percentage (40-95%) indicating reliability based on number of matching indicators

### Security Analysis 
Detects important security headers to assess website security posture:
- **Content Security Policy (CSP)**: Protection against XSS attacks
- **X-Frame-Options**: Clickjacking protection
- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing

### Export Functionality
Export detected technologies, infrastructure, security analysis, and "Ammavan gossip" as JSON with satirical commentary!

## Installation

### For Development
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the directory containing this extension
6. The extension icon will appear in your toolbar

### For Users
*(Extension will be published to Chrome Web Store)*

## Usage

1. Navigate to any website
2. Click the Site Ammavan extension icon in your toolbar
3. Click "Scan page" button
4. View:
   - **Ammavan Verdict**: A witty one-line summary
   - **Ammavan Findings**: Non-obvious tech and security insights
   - **Technologies**: Detected frameworks and libraries
   - **Infrastructure**: Hosting providers and servers
5. (Optional) Click "Export JSON" to save the full "gossip report"

## How It Works

### Technology Detection
- Analyzes JavaScript script sources
- Checks for global variables and objects
- Inspects DOM attributes and patterns
- Reads meta generator tags

### Infrastructure Detection
- Intercepts HTTP response headers using Chrome's webRequest API
- Analyzes server headers (`Server`, `X-Powered-By`, `X-Generator`)
- Detects platform-specific headers (e.g., `cf-ray` for Cloudflare, `x-vercel-id` for Vercel)
- Accumulates detections across all page requests
- Tracks confidence scores based on number of matching indicators:
  - Platform-specific headers (e.g., `x-vercel-id`) contribute more weight (+2)
  - Generic pattern matches contribute less weight (+1)
  - Confidence percentages range from 40% (minimal match) to 95% (strong match)
  - Results sorted by confidence (highest first)
- Caches results per tab for quick access

## Architecture

```
├── manifest.json          # Extension configuration
├── background.js          # Service worker for HTTP header interception
├── content_scripts/
│   └── detect.js         # Runs in page context to detect technologies
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup logic and coordination
│   └── popup.css         # Popup styling
└── data/
    └── signatures.json   # Technology detection signatures
```

## Key Improvements

### Logical Fixes
1. **Accumulation Logic**: Infrastructure detections now accumulate across all page requests instead of being overwritten by each request
2. **Memory Management**: Automatic cleanup of cached data when tabs are closed
3. **UI Integration**: Infrastructure results are now properly fetched and displayed
4. **Header Analysis**: Checks both header names and values for comprehensive detection
5. **Confidence Scoring**: Each hosting/CDN detection includes a confidence percentage (40-95%) to avoid confusion when multiple providers are detected

### Enhanced Detection
- Added support for 12 major hosting providers
- Specific header pattern matching for popular platforms
- Server type identification from standard headers

## Development

### File Structure
- `background.js` - Background service worker handling HTTP requests
- `content_scripts/detect.js` - Content script for in-page technology detection
- `popup/` - User interface components
- `data/signatures.json` - Technology detection patterns

### Adding New Signatures
Edit `data/signatures.json` to add new technology detection patterns:
```json
{
  "name": "Technology Name",
  "checks": [
    {"type": "script_src_regex", "value": "pattern", "weight": 0.5},
    {"type": "global_var", "value": "variableName", "weight": 0.3}
  ],
  "category": "category name"
}
```

### Adding New Infrastructure Signatures
Edit `background.js` to add new infrastructure detection patterns:
```javascript
const INFRA_SIGNATURES = [
  { name: "Provider Name", regex: /pattern/i }
];
```

### Export Format
The extension exports a comprehensive "Ammavan Gossip Report" with satirical commentary:
```json
{
  "ammavan_says": "☕ Well well well, look what we have here...",
  "verdict": "Modern React site hiding behind Cloudflare. Decently secured.",
  "findings": [
    "Site uses React (probably over-engineered for what it does)",
    "Hides server using Cloudflare (smart move)",
    "No CSP header (risky - XSS attacks welcome)"
  ],
  "technologies": [...],
  "infrastructure": {...},
  "gossip_level": "High",
  "ammavan_rating": {
    "security": "😐 Could be worse",
    "modernity": "🚀 Living in 2024",
    "privacy": "👀 They're watching"
  },
  "disclaimer": "This report is brought to you by your friendly neighbourhood Ammavan..."
}
```

## Testing

See [TESTING.md](TESTING.md) for detailed testing instructions.

## Permissions

- `webRequest` - To intercept and analyze HTTP headers for infrastructure detection
- `activeTab` - To inject detection scripts into the current page
- `scripting` - To execute content scripts dynamically
- `storage` - For future feature enhancements
- `host_permissions` - To access all URLs for comprehensive detection

## Privacy

This extension:
- ✅ Operates entirely locally in your browser
- ✅ Does not send any data to external servers
- ✅ Does not track your browsing history
- ✅ Only activates when you click the extension icon

## License

This project is open source. Feel free to contribute!

## Contributing

Contributions are welcome! Please feel free to submit pull requests with:
- New technology signatures
- Infrastructure provider patterns
- Bug fixes
- UI improvements

