# R57-T046 evidence

## Baseline

Before editing, `index-START.html` rendered 19 links and the lesson text, but its starter script was empty: hovering a link created no highlight and there was no message for a browser without element geometry measurement. Baseline snapshot, viewport, link geometry, browser versions, and console/page error state are in `baseline.json`.

## Changed behavior

With geometry support, the page creates one decorative highlight and moves/resizes it to match hovered links, including a scrolled content link. With `Element.prototype.getBoundingClientRect` removed in the isolated unsupported fixture, the page renders a status message and keeps all 19 links enabled. The check compares two fresh supported contexts for identical results and checks that neither path logs errors.

## Run and evidence

Run `node tests/course/r57-t046.mjs` from the repository root. `results.json` records inputs, expected and actual values, tool versions, and cleanup status. `supported.png` and `unsupported.png` are review aids; DOM, event, layout, and error assertions determine pass or fail.
