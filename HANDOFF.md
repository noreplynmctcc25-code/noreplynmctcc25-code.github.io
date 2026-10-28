# Gradu project handoff

Updated 2026-10-29

## Release state

- The last recorded published release is app version 210 with main cache key `eclass-v218`, app commit `844db8d` on [GitHub main](https://github.com/noreplynmctcc25-code/noreplynmctcc25-code.github.io/tree/main).
- At the last verification GitHub Pages returned HTTP 200 and, after reload, the live app showed `VER=210` with cache key `eclass-v218`. The live site was not rechecked during this local update. The previous release was version 209/eclass-v217, app commit `4249b47330a8b80d55c03c60bd135a50ece088b9`.
- The main site is https://noreplynmctcc25-code.github.io/. GitHub Pages serves the repository root.
- The provided editing workspace is an extracted copy without `.git` metadata; the release was committed and pushed from a separate Git-backed clone.
- The latest local source is visible app version 1.44/cache eclass-v242 with scanner cache clearscan-v10 and the UX/accessibility changes recorded below. It has not been deployed; the version 211 voice update is a prior local iteration.

## UX/accessibility implementation (local only — 2026-10-29)

- Local source is now visible app version 1.44, main offline cache `eclass-v242`, and standalone scanner cache `clearscan-v10`. The last recorded deployed release remains version 210/eclass-v218; these changes have not been deployed or checked against the live site.
- Main class cards now have separate native open/performance controls; note list/card actions are siblings instead of nested interactive controls. Note action and disclosure-menu hit areas use larger minimum sizes, including the final cascade rule, and focus is visible on native disclosures. Custom `role=button` controls receive Enter/Space activation and visible focus. The student toolbar prioritizes Add student and groups archive/delete under More; the duplicate New class item was removed from Quick actions. Mobile dashboard swipe cards now have an instruction.
- Scanner text and action colors were darkened for legibility, including library/status labels and icon colors; focus indicators now work against both the light editor and dark camera. Supporting text was enlarged, phone quick actions now use two columns, and desktop gets a side navigation/workspace layout. Navigation, sorting, and view states now have accessible names/states. Scanner dialog focus is moved in on open, contained while open, and restored on close. Photo import labels are keyboard-operable.
- Manual crop now has a corner selector and directional nudge controls as an alternative to dragging. Existing drag editing remains available.
- Reusable findings are captured in the workspace skill `Design/skills/gradu-ux-accessibility/SKILL.md`, outside the published site. The installed `.agents/skills` tree is read-only in this workspace, so the existing web/mobile designer skills were not edited.
- No runtime, keyboard-flow, screen-reader, or automated checks were run. A local browser preview was attempted, but workspace socket permissions blocked the localhost connection and browser policy disallowed file URLs. Before publishing, review at 320/390/768/1280px, verify the main class/test/scanner tasks, and recheck all main-app theme color combinations. WCAG 2.2 AA is a reference target, not a compliance claim.

## Packaging status (2026-10-29)

- Windows installer `Gradu-Setup-1.44.exe` and its blockmap were built from the current app assets and saved in the workspace package folder. Electron Builder reported no Windows code-signing certificate, so this installer is unsigned.
- AndroidStandalone is synced to the current web assets. `sync-web.ps1` now supports Windows PowerShell 5.1; the Gradle app version is 1.44 with version code 143. The signed APK was not rebuilt because the four `GRADU_SIGN_*` signing variables are absent from this execution environment. The existing signed APK was left untouched.
- Release workflow learnings are captured in the workspace skill `Design/skills/gradu-release-packaging/SKILL.md`, outside the published site.
- The `.publish-checkout/` branch was clean at `7644bdb` (app version 1.42/cache eclass-v240, scanner cache clearscan-v8) when release preparation began. The version 1.44 web release is pending push at this point in the handoff.

## Version 211 opening voice update (historical local iteration)

- The intro now plays the bundled `gradu-voice.wav` recording, generated with Microsoft Zira Desktop. It says only “Gradu” and gives Edge and Chrome the same voice source.
- Removed the upper-right Enable sound control. The intro still attempts playback automatically, then uses the first tap or key press on the intro as a browser autoplay gesture when needed. The About setting can still disable the opening sound.
- Added the audio clip to the main service worker precache and bumped the local app/cache versions to 211/eclass-v219.
- This workspace change has not been deployed, and no cross-browser playback check was run.

## Version 210 Test tab fix

- Version 210 with main cache key `eclass-v218` fixes the Test tab's Answer key panel and was published in app commit `844db8d`.
- The Key panel called `itemNo`, which is scoped inside the test-engine closure and unavailable to the outer panel renderer. The resulting `ReferenceError` stopped rendering after the tab navigation changed, leaving the previous panel visible. The renderer now calls the shared app-level `tbItemNo` helper.
- Node.js syntax checking passed for all five inline JavaScript blocks. The pre-fix browser reproduction confirmed the Key activation raised `ReferenceError: itemNo is not defined` and left the previously rendered panel visible. The deployed app was confirmed at version 210 after reload; a post-fix Key click-through was not repeated because the guest profile has no class/test data.

## App structure

- `index.html` contains the main static class-record PWA, most styles and application logic, the Tests tab, and the integrated test scanner.
- `scanner/` contains a separate scanner PWA. The main app also loads `scanner/scanner-engine.js`.
- `sw.js` manages the main app's offline cache. `scanner/sw.js` has a separate cache generation.
- `inter.woff2` and `fraunces-latin*.woff2` are locally loaded web fonts; `OFL-Fraunces.txt` records Fraunces's license. The main service worker precaches both Fraunces files. Test answer-sheet item labels and option glyphs use Inter while the circle layout remains fixed.
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
5. Verify the remote commit and that GitHub Pages serves the expected version and cache key; record the deployed release state here.

README and HANDOFF are documentation; the app does not load them, so editing them does not change app behavior. Keep these documents aligned with the code before publishing.

## Integrations and data

- Class records are stored in the browser. Signed-in users can sync JSON and attachments to Google Drive; guest mode stays local to the current browser profile.
- The app uses Google OAuth, Drive, and optional Gmail workflows. The Assistant accepts user-provided Gemini or Anthropic keys from the browser; do not put private keys or tokens in the repository.
- Student records can include names, attendance, grades, emails, and notes. Protect device and account access and keep a backup for records that must be recoverable.
- PDF and Word processing use bundled PDF.js and Mammoth. Some OCR flows load Tesseract.js from jsDelivr and need network access.
- Android Trusted Web Activity association is configured in `.well-known/assetlinks.json`; Android release/signing files are stored separately from this site repository.
