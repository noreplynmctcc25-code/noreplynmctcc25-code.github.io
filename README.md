# Gradu · Class Record

Gradu is a static, browser-based class record and teacher workbench. The current web app is in this folder; it has no build step or server-side application. It can be served from any HTTPS static host. The current published app is version 210 with main cache key eclass-v218, app commit 844db8d. It fixes the Test tab Answer key panel so it renders when selected. GitHub Pages serves VER=210; see HANDOFF.md for deployment and verification details.

## What the app does

- Manage classes, student rosters, groups, attendance, and Prelim, Midterm, and Final grading periods.
- Calculate grades from configurable class rules; review student and class performance, compare classes, and print or export records.
- Create tests and answer keys, print answer sheets, scan marked responses, and review item analysis. New tests start with no selected subject, grading period, component, or date. Choosing a subject with multiple active sections opens a section picker with all sections selected by default. The test name, subject, section assignment, grading period, and component are required; the date is optional and prompts for confirmation if blank. The Setup tab lets you revise the subject and sections; scanning and score posting use the saved section selection. Test numbering defaults to restarting at 1 within each test section; continuous numbering is available as an alternative. Visible labels include the test section and type, while scanning, answer checking, score adjustments, and response storage use stable internal item positions. This keeps repeated labels such as “Item 1” mapped to the correct test section. The Answer key tab now uses the app-level item-number helper so its content renders when selected.
- Keep dated notes, syllabus files, a class diary, assignments, and a calendar derived from class schedules and due dates.
- Generate student record PDFs, export the official DBME workbook, and send records or test results through the signed-in Gmail account.
- Choose from 20 preset four-color pairings grouped into Classic, Pastel, and Vivid, each shown with a pie-chart color swatch. When no palette or custom theme is selected, the app picks the closest pairing to the configured school's logo colors. The TCC default is Blue & Orange. Toasts appear above dialogs and modals.
- Sync class data and attachments to the signed-in user's Google Drive. Offline guest mode keeps data in the current browser profile.
- Use the built-in document scanner to capture or import pages, crop and clean them, and create PDFs.
- Use the Assistant with a user-provided Gemini or Anthropic API key. Requests go directly from the browser to the selected provider.
- Provide optional department-head summaries, department settings, shared grading rules, and deadlines.

The interface adapts between desktop navigation and a mobile layout. Some class tabs are grouped under More on narrow screens. On 1280–1440px fine-pointer desktop screens up to 900px high, base typography scales down to 13.5–14px. Headings use Fraunces; body text, tables, numeric fields, score figures, and printed test item numbers use Inter. Both fonts are bundled locally and included in the main offline cache, so the app does not depend on Google Fonts at runtime.

## Source layout

| Path | Purpose |
| --- | --- |
| index.html | Main app, styles, class-record workflows, Google integrations, and the embedded test-scan UI. Most of the application is inline in this file. |
| scanner/ | Standalone scanner PWA, its editor, local scan library, and shared scanner engine. The main app also loads scanner/scanner-engine.js for its scanner flow. |
| scanner/storage.js | Scanner metadata in localStorage and PDF blobs in IndexedDB. |
| scanner/app.js, tools.js | Scanner dashboard, navigation, manual count, and calibrated measurement tools. |
| sw.js, scanner/sw.js | Offline caching for the main app and standalone scanner. |
| inter.woff2, fraunces-latin*.woff2, OFL-Fraunces.txt | Locally bundled Inter and Fraunces web fonts and the Fraunces license. |
| manifest.json, scanner/manifest.json | Installable PWA settings. |
| mammoth.min.js | Word document parsing used by syllabus and document workflows. |
| pdf.min.js, pdf.worker.min.js | PDF rendering used for import, preview, and scan workflows. |
| templates/eclass-dbme.xlsx | Official DBME workbook used for spreadsheet export. |
| schools/, logo.png, city-seal.jpg, icon files | School identity, logos, and PWA artwork. |
| drive-access-test.html | A standalone diagnostic page for Google Drive authorization. |
| .well-known/assetlinks.json | Android Trusted Web Activity association for the published site. |

The main app keeps its HTML, CSS, and JavaScript together in index.html; scanner files are separate. There is no package manifest, dependency install, bundler, or automated test suite in this folder.

## Run locally

Serve this folder over HTTP rather than opening index.html as a file. From this folder, run:

    py -m http.server 8000

Then open http://localhost:8000/. Localhost is treated as a secure context by current browsers, which is needed for camera and service-worker features. Camera capture requires a browser permission grant.

## Google and AI setup

Google sign-in uses a Google OAuth Client ID. The client ID field is empty in the source and can be supplied on the sign-in screen or configured in the page. Add the production site and local development origin/redirect address to the OAuth client. Enable the Google Drive API for sync; enable the Gmail API if using email actions. The app asks for Drive access at sign-in and requests Gmail send access only when an email action needs it.

The Drive Picker used for department-file selection also needs its Google API key and application ID configured in the app's department settings.

The Assistant requires a Gemini or Anthropic key entered by the user. Keys are stored in that browser profile and calls are made directly to Google or Anthropic; this static app has no proxy server. Do not commit personal API keys or OAuth tokens.

## Data and privacy

- Class data is stored first in the browser. The main app stores its class model in localStorage and file attachments in browser storage; signed-in sync writes the app's JSON file and attachment files to the user's Google Drive.
- Local browser data is scoped to the browser profile and origin. Clearing site data or changing browser profiles can make it unavailable. Keep a JSON backup or Drive sync for records that must be recoverable.
- Test and class records can contain student names, emails, attendance, grades, and notes. Protect the device and the connected Google account accordingly.
- AI prompts may include class-derived information. Review the content and provider before using the Assistant with student data.
- The optional department summary is narrower than a full class backup: it contains student names, grades, status, and absences. The app's sharing flow excludes student email, notes, and files.

## Scanner limits

Image and PDF processing runs in the browser. The scanner can detect page edges, perspective-crop, adjust filters, split a centered book spread, reorder pages, and export PDFs. Its count and measure tools require manual marking/calibration. AI inpainting, handwriting erasure, and learned dewarping are not implemented. PDF import is rasterized to images, so exported pages do not preserve the source PDF's selectable text or annotations. Standalone scanner-library files are stored in that browser profile.

## Versioning and deployment

Publish the contents of this folder at the app's site root so the relative asset paths, manifests, and service-worker scope line up. The installer scripts in the sibling Google Play package point to https://noreplynmctcc25-code.github.io/.

The current published release is version 210 with main cache key eclass-v218 in app commit 844db8d. GitHub Pages returned HTTP 200 and served VER=210. The release fixes Answer key tab rendering. Fraunces and Inter are bundled for local browser loading, including on printed test item numbers and option glyphs. The app displays its release number from the VER constant in index.html. The main service worker has a separate cache key in sw.js; bump that key when changing cached app files so installed PWAs download a fresh cache. The scanner has its own cache key in scanner/sw.js and should only be bumped when scanner-cached files change.

Before every commit and push, update this README with the current app version/cache key and user-facing changes, and update HANDOFF.md with implementation, checks, and deployment status. Then run appropriate checks, inspect the diff and status, commit only intended files, push, and verify the GitHub commit and deployed Pages version/cache key. README and HANDOFF files are documentation: they are not loaded by the app and changing them does not alter app behavior.

For architecture, deployment, data handling, and maintenance notes, see [HANDOFF.md](HANDOFF.md).



