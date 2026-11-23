# Event Capture, Propagation, Bubbling and Once

## Run

Open `index-START.html` through a local HTTP server.

## Regression test

From the repository root, run:

`node tests/course/r57-t024.mjs`

The regression check uses Playwright to verify that repeated interaction with the event-propagation example does not duplicate event effects or test-created DOM nodes.

Evidence is stored in `work/R57-T024/`.