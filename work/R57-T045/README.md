# R57-T045 browser evidence

Run `node tests/course/r57-t045.mjs` after `npm ci` and `npx playwright install chromium`. The test starts a loopback server and opens the pre-edit source and current page in separate fresh contexts at 1440×900, device scale factor 1. It loads the lesson favicon through a local SVG fixture, locks the test font stack, compares script state, rendered DOM and computed layout, and records tool versions. `results.json` contains expected and observed values plus cleanup status. `page.png` supports visual review; assertions determine pass or failure.

## Baseline

The starter has no rendered text; its body contains only the inline lesson script. The script defines the `players` array and `person` object. Its favicon points to `fav.farm`; the regression fulfills that request with the local SVG fixture. The baseline produced the same DOM and layout in Chromium 159 with no page or console errors.

## Changed behavior

The page now references its checked-in `favicon.svg` instead of a remote favicon service. With the local icon and deterministic font fixture, a second fresh context produced the same script values, DOM, text, viewport and computed layout as the baseline. The test recorded no errors and closed both contexts, Chromium and the local server.
