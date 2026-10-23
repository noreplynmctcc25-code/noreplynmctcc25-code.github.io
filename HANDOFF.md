# Gradu project handoff

Updated 2026-10-23

## Current release

- This repository is the static-site source for [noreplynmctcc25-code.github.io](https://noreplynmctcc25-code.github.io/); `main` publishes the repository root through GitHub Pages.
- The app displays version 204 in `index.html`. The main service worker uses cache key `eclass-v210` in `sw.js`; the standalone scanner has its own cache generation in `scanner/sw.js`.
- Before this update, `main` was at `3665201280196bcf2fa44e79dfe3415c6be16af7`, with app version 203 and main cache key `eclass-v208`.
- Test creation now asks teachers to confirm the target sections when the selected subject has multiple active sections. All are selected initially, and the teacher can keep all or choose one or more. The test Setup tab allows changing both subject and sections later. Scanning, response review, analysis, and score posting use the test's saved section selection.

## App layout

This is a static browser app. There is no build step or server-side application. Most of the class-record UI, styles, business rules, and integrations are in `index.html`; scanner code is in `scanner/`. Other files include the service workers, manifests, school branding, the spreadsheet template, PDF.js, Mammoth, and the Android Trusted Web Activity association at `.well-known/assetlinks.json`.

The main navigation includes class and student management, attendance, grading periods, assignments, diary, calendar, notes and syllabus files, tests and answer sheets, scanning and item analysis, reports, student-record PDFs, class comparisons, email actions, department sharing, and the browser-based Assistant. The standalone scanner captures or imports pages, edits crops and filters, stores scans in the browser, and exports PDFs. The test-scan workflow uses the shared scanner engine.

## Develop and deploy

Serve the repository root over HTTP for local development:

    py -m http.server 8000

Open `http://localhost:8000/`. Use HTTPS or localhost for camera, service-worker, and PWA features. Publish the repository root; preserve the relative paths and `.well-known/assetlinks.json` for the Android TWA.

When preparing a release, update the visible `VER` constant in `index.html` and bump `V` in `sw.js` when cached app files change. The scanner's cache key in `scanner/sw.js` is managed separately. The service worker updates cached content in the background, so an installed PWA can show the new page after its next reload or launch.

Google sign-in uses a configured OAuth client ID. Drive sync needs the Google Drive API, and Gmail actions need Gmail API access. Department file picking also requires its API key and application ID. Assistant keys are entered by the user and stored in that browser profile; requests go directly from the browser to the selected provider. Do not commit credentials, personal API keys, student exports, or signing material.

## Data and limits

Class data is stored in the browser. Signed-in sync writes the app's JSON and attachment files to the user's Google Drive; guest mode stays in the current browser profile. Clearing site data or switching profiles can make local records unavailable. Student data can include names, emails, grades, attendance, and notes; protect the device and connected accounts.

The app has no authoritative server-side database or server-side role enforcement. Client-side checks are not a security boundary for high-impact decisions. Department summaries include student names, grades, status, and absences, but exclude emails, notes, and attachments. AI prompts may contain class-derived information, so review the content and provider before sending it.

The scanner's measurement and count tools require manual calibration or marking. AI inpainting, handwriting removal, and learned dewarping are not implemented. PDF pages are rasterized for editing and export, so selectable text and annotations are not preserved. OCR may load Tesseract.js from a CDN and needs network access.

## Verification notes

The section-selection change was reviewed in the app source. No automated or UI tests were run for this update. To verify manually, create a test for a subject with multiple active sections, confirm the initial all-selected section picker, save a subset, then change the subject and sections in Setup and confirm the resulting scan and score-posting target.
