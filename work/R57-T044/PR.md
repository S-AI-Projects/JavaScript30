# Make Custom Video Player initialization safe to repeat

## Summary

- Add the intended playback, skip, volume, playback rate, progress, and scrub handlers to the starter page.
- Guard initialization so loading `scripts.js` a second time does not register duplicate handlers.
- Add a Playwright regression that initializes twice and repeats each interaction with deterministic media stubs.

## Checks

Run `npm ci`, `npx playwright install chromium`, then `node tests/course/r57-t044.mjs`. The browser check records baseline and changed behavior, event registrations, media effects, rendered progress, DOM counts, active timers, cleanup, tool versions, and page errors. Evidence: `work/R57-T044/results.json` and `work/R57-T044/changed-player.png`.
