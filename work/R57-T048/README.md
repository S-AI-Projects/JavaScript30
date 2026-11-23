# R57-T048 evidence

## Baseline

The source page `28 - Video Speed Controller/index-START.html` contains the video element with native controls and an initial `1×` speed bar. It has no text input, textarea, or editable region. The test records its dimensions and baseline UI, uses a deterministic local background/icon, and omits the remote video source so the check does not depend on a public media host.

## Changed behavior

The isolated `text-rendering.html` companion displays user input using `textContent`. The checked string includes `[image](https://github.com/S-AI-Projects/JavaScript30/issues/x)` and an HTML image with an error handler. Assertions confirm the exact string is rendered as one text node, no image/link/other injected node appears, and the handler remains false.

## Run and evidence

Run `node tests/course/r57-t048.mjs` from the repository root. `results.json` stores inputs, expected and actual values, tool versions, browser errors, and cleanup status. `video-lesson-baseline.png` and `text-preview-literal.png` are screenshots supporting the DOM and layout assertions.
