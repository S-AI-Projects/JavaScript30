# R57-T043 browser evidence

Run: `node tests/course/r57-t043.mjs` (Chromium via Playwright). The test serves the page and local fixture from an ephemeral loopback HTTP server and captures baseline and changed behavior in one fresh browser context. `results.json` records inputs, expected checks, baseline/actual DOM and layout results, and runtime versions. `fixtures/landscape.svg` is the valid recovery asset; the test returns a deliberate 404 for the initial image request. `changed-page.png` is a review screenshot; assertions are the pass/fail signal.

## Baseline

The pre-edit `index-START.html` contains five `.slide-in` images. With the first image request forced to HTTP 404, it showed no text fallback (`naturalWidth: 0`). Scrolling to a later image did not add `.active`; START contained no scroll listener. The paired `index-FINISHED.html` has the scroll-reveal handler, which was added to START to retain the lesson's intended behavior.

## Changed behavior

The browser check asserts a readable status fallback with reserved image dimensions on 404, restores the image from the valid SVG fixture and removes the fallback, verifies offscreen opacity and scroll reveal/hide effects, and rejects uncaught page errors. See `results.json` for exact expected and observed values.
