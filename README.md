# Site Ammavan - Browser Extension

A Chrome extension that detects technologies, frameworks, and infrastructure used by websites - just like the neighbourhood ammavan (gossiper) peeks into your life!

## Features

### Technology Detection
Automatically detects common web technologies including:
- JavaScript frameworks (React, Angular, Vue, Svelte)
- JavaScript libraries (jQuery)
- Content Management Systems (WordPress)
- Analytics tools (Google Analytics)

### Infrastructure Detection ✨ NEW
Identifies hosting providers and infrastructure services through HTTP header analysis:
- **CDN Providers**: Cloudflare, Akamai, Fastly
- **Cloud Platforms**: AWS, Google Cloud, Azure
- **PaaS Providers**: Vercel, Netlify, Heroku
- **Other Services**: GitHub Pages, Firebase, DigitalOcean

### Export Functionality
Export detected technologies and infrastructure information as JSON for further analysis.

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
4. View detected technologies and infrastructure
5. (Optional) Click "Export JSON" to save results

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

## Credits

Developed with ❤️ for the web development community.
