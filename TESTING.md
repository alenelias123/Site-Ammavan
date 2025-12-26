# Testing Guide for Site Ammavan Extension

## Manual Testing Instructions

### Loading the Extension

1. Open Chrome or any Chromium-based browser (Edge, Brave, etc.)
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked"
5. Select the folder containing the extension files
6. The extension should now be loaded and visible in the extensions toolbar

### Testing Infrastructure Detection

1. Navigate to various websites with different hosting providers:
   - **Cloudflare**: Try any major website (many use Cloudflare CDN)
   - **Vercel**: Try https://vercel.com or any Next.js showcase site
   - **Netlify**: Try https://www.netlify.com or Netlify-hosted sites
   - **AWS**: Try various sites hosted on AWS
   - **GitHub Pages**: Try https://pages.github.com or any `*.github.io` site
   - **Heroku**: Try sites with heroku in their domain or headers

2. Click the extension icon in the toolbar
3. Click "Scan page" button
4. Verify that the following sections are populated:
   - **Technologies**: Should show detected JavaScript libraries/frameworks
   - **Infrastructure**: Should show detected hosting providers and server information

### Expected Results

- Technologies section should show libraries like jQuery, React, Angular, WordPress, etc.
- Infrastructure section should show:
  - Server type (e.g., "nginx", "Apache", "cloudflare")
  - Hosting/CDN platforms detected (e.g., "Cloudflare", "Vercel", "Netlify")

### Testing Export Functionality

1. After scanning a page, click the "Export JSON" button
2. A JSON file should be downloaded containing:
   - `technologies`: Array of detected technologies
   - `infrastructure`: Object with `server` and `infrastructure` arrays

### Verification Checklist

- [ ] Extension loads without errors
- [ ] Can scan multiple pages in succession
- [ ] Technologies are detected correctly
- [ ] Infrastructure/hosting platforms are detected
- [ ] Server information is shown when available
- [ ] Export functionality works and produces valid JSON
- [ ] UI displays "No technologies detected" when appropriate
- [ ] UI displays "No infrastructure detected" when appropriate
- [ ] Cache is cleared when tabs are closed (no memory leaks)

## Known Limitations

- Infrastructure detection depends on HTTP headers being present
- Some websites may not expose server information in headers
- Detection accuracy depends on the signatures defined in `data/signatures.json`
