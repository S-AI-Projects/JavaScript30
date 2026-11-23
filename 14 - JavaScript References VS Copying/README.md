# JavaScript References VS Copying

Open `index-START.html` in a browser to inspect the starter lesson. Its JavaScript variables are defined in the page script; the starter does not render visible text.

## Browser regression

From the repository root, run `npm ci`, install Chromium with `npx playwright install chromium`, then run `node tests/course/r57-t045.mjs`. The check locks the viewport and font stack, fulfills the external favicon request from a local SVG fixture, and compares the rendered state in two fresh browser contexts.
