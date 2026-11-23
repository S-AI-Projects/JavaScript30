# R57-T044 browser evidence

Run `node tests/course/r57-t044.mjs` after `npm ci` and `npx playwright install chromium`. The check uses an ephemeral loopback server and fresh browser contexts. It stubs the media API so playback and seeking are deterministic without decoding the bundled video. `results.json` contains the inputs, expected checks, baseline and changed observations, runtime versions, and cleanup status. `changed-player.png` is for visual review; assertions determine pass or failure.

## Baseline

The original `scripts.js` was empty. In Chromium, clicking Play left the video paused (`playCalls: 0`), and clicking Skip left its current time at zero (`seekWrites: 0`). The page rendered six control children and registered no player event handlers.

## Changed behavior

The player now attaches its handlers once and ignores a second script load. The check confirms 15 distinct player action handlers before and after that load, two play/pause toggles produce one call each, repeated skip and slider actions each produce one media update per interaction, scrubbing updates the progress layout, no duplicate DOM nodes or active timers appear, and there are no uncaught page errors. Contexts, browser, and local server are closed in cleanup.
