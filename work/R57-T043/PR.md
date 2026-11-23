# Add failed image fallback and browser regression to Slide in on Scroll

## Summary

- Add descriptive alt text, reserved image dimensions, and a readable status fallback when a lesson image returns an error.
- Clear the fallback when that image loads successfully again.
- Add the scroll reveal handler to `index-START.html`, matching the behavior demonstrated by the paired finished example.
- Add a deterministic Playwright check with a deliberate 404 and a local SVG recovery fixture.

## Checks

Run `npm ci`, `npx playwright install chromium`, then `node tests/course/r57-t043.mjs`. The check records baseline and changed behavior, validates fallback layout and recovery, exercises scroll reveal and hide effects, and rejects uncaught page errors. Evidence: `work/R57-T043/results.json` and `work/R57-T043/changed-page.png`.
