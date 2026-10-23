# Gradu project handoff

Updated 2026-10-23

## Release state

- The last confirmed published release is app version 206 with main cache key `eclass-v214`, commit `8fc4afd9dd49c33873f9102a0be1d74b681a0dd8` on [GitHub main](https://github.com/noreplynmctcc25-code/noreplynmctcc25-code.github.io/tree/main).
- The current local app source is version 207 with cache key `eclass-v215`. It includes default section-restart test numbering, selectable continuous numbering, and preset palettes grouped into Classic, Pastel, and Vivid with pie-chart swatches. This version has not been pushed or verified on Pages.
- The main site is https://noreplynmctcc25-code.github.io/. GitHub Pages serves the repository root.
- The local workspace surrounding this folder is an extracted copy and does not contain `.git` metadata. Use a Git-backed clone to commit or push.

## App structure

- `index.html` contains the main static class-record PWA, most styles and application logic, the Tests tab, and the integrated test scanner.
- `scanner/` contains a separate scanner PWA. The main app also loads `scanner/scanner-engine.js`.
- `sw.js` manages the main app's offline cache. `scanner/sw.js` has a separate cache generation.
- `schools/`, icons, `logo.png`, and `city-seal.jpg` provide school identity and PWA assets. `templates/` contains the DBME workbook template.
- The app has no build step or server-side application. Serve this folder over HTTP for local development (`py -m http.server 8000`).

## Test numbering and answer mapping

- New tests default to restarting the visible item number at 1 in each test section. Setup also offers continuous numbering. Existing saved tests with no `numMode` use the section-restart default; tests saved as continuous remain continuous.
- Each item keeps a stable internal `no` for scan flags and score-adjustment keys, plus its section/item position (`si`/`pi`). Objective answer strings and scoring follow the unchanged printed section/item order; essay scores follow essay item order. A separate display number `dn` controls the printed and visible label. Changing numbering mode therefore does not shift stored answers or change which answer is checked.
- Labels and references include the test's section order and type (for example, “Test II · True / False · Item 1”). Scan review also shows a type label. This makes repeated visible numbers identifiable by their section/type.
- Inline JavaScript syntax parsing and a targeted mixed-section mapping check passed for both modes, including essay items and stable IDs. A full browser-driven scan-to-score run was not performed, so verify with a sample printed answer sheet before relying on a production assessment.

## Release procedure

Before every commit and push:

1. Update the visible app version in `index.html` for an app release.
2. Bump `sw.js`'s cache key when files listed/cached by the main app service worker change. Bump `scanner/sw.js` only when scanner-cached files change.
3. Update `README.md` with the current version/cache key and user-facing changes. Update this `HANDOFF.md` with implementation, checks, and deployment state.
4. Run appropriate checks and inspect the complete diff and Git status. Commit only intended files, then push to `main`.
5. Verify the remote commit and that GitHub Pages serves the expected version and cache key.

README and HANDOFF are documentation; the app does not load them, so editing them does not change app behavior. Keep these documents aligned with the code before publishing.

## Integrations and data

- Class records are stored in the browser. Signed-in users can sync JSON and attachments to Google Drive; guest mode stays local to the current browser profile.
- The app uses Google OAuth, Drive, and optional Gmail workflows. The Assistant accepts user-provided Gemini or Anthropic keys from the browser; do not put private keys or tokens in the repository.
- Student records can include names, attendance, grades, emails, and notes. Protect device and account access and keep a backup for records that must be recoverable.
- PDF and Word processing use bundled PDF.js and Mammoth. Some OCR flows load Tesseract.js from jsDelivr and need network access.
- Android Trusted Web Activity association is configured in `.well-known/assetlinks.json`; Android release/signing files are stored separately from this site repository.
