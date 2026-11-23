# Make the references lesson deterministic in browser checks

## Summary

- Replace the external favicon service with a small checked-in SVG icon.
- Add a Playwright regression that compares the baseline and changed page in two fresh contexts.
- Lock the browser viewport and font fixture, and use a local favicon fixture for the baseline request.

## Checks

Run `npm ci`, `npx playwright install chromium`, then `node tests/course/r57-t045.mjs`. The test asserts the lesson variables, rendered DOM, computed layout, local icon load, identical fresh-context results, and absence of page or console errors. Evidence: `work/R57-T045/results.json` and `work/R57-T045/page.png`.
