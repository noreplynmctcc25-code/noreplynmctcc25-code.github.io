# Gradu Scanner

The mobile dashboard and capture flow follow the document-library, quick-action, bottom-navigation, camera, and filter-editor patterns from the CamScanner app, implemented with original HTML/CSS and no copied CamScanner branding or artwork.

Standalone browser scanner PWA at `/scanner/`. It reuses the existing Gradu scanner's local image pipeline and PDF writer, with independent UI and local scan storage.

The Test Scan camera action loads this scanner engine and its stylesheet directly into the main app page, so the camera runs in the top-level page instead of an iframe. Choosing **Save to Scan tab** saves the PDF to that class's scan library and adds it to the test page upload flow. Its default filename uses the grading period, component, subject code, and selected section names. The Test Scan **Saved scans** button opens that same class library.

## Included in this browser build

- Camera or photo capture, live page-edge detection, perspective crop, manual corner adjustment, image-and-crop rotation, swipe navigation with page transitions, reorder, and deletion. Camera capture requests a high-resolution stream and uses the browser's native still-photo API when available, with a video-frame fallback; imported/captured sources are retained up to 3,200 pixels on the long edge.
- Enhanced color, grayscale, two black-and-white looks, lightening, whiteboard contrast, local shadow normalization, and grain reduction.
- Split a centered book spread into two pages.
- Multi-image and multi-PDF import, page reorder/delete, PDF merge on export, separate-page PDF splitting, compression presets, and page-size options. Balanced export is now 2,400 pixels on the long edge by default; High exports at 3,200 pixels, while Small remains available for compact files.
- A4 print layouts with two ID-card copies at nominal ID-1 dimensions or four 35 × 45 mm passport photos.
- Manual image item counting and calibrated distance measurement from a known reference length.
- Browser-local saved scan library.
- PDF.js support for importing an existing PDF as editable scan pages.

Camera access requires HTTPS (or localhost) and a camera permission grant. If the browser rejects the preferred camera settings, the scanner retries with basic video settings; if startup still fails, it explains common permission/device problems and offers a retry plus photo-import options. Image and PDF processing is client-side; saved PDFs remain in this browser profile.

## AI model packs

The Android APK's JNI libraries are not browser modules. Finger/obstruction removal, handwriting erasure, and learned dewarping require model weights plus a browser runtime and task-specific input/output adapters. The APK archive has barcode TFLite models and a proprietary `csice.dat`, but no browser-ready cleanup model weights; the purpose and format of `csice.dat` are not established. Those learned cleanup operations are not active features yet. The existing contrast normalization and noise reduction are deterministic image-processing filters, not generative AI.

The book tool splits at the center line; it does not detect the spine or flatten curved paper. Manual count and measurement tools do not perform automatic object recognition. The crop editor has four corner handles. Whiteboard cleanup improves contrast but does not reconstruct glare-obscured content. The included filter pipeline is image processing, not a machine-learning super-resolution model.

PDF imports are rendered to page images before editing and export. Output pages preserve their visual appearance, but not the original PDF's selectable text layer or annotations.
