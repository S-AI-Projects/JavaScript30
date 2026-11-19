# Array Cardio Day 1

Open `index-START.html` and follow the prompt to inspect the JavaScript console. The array exercises are intentionally console based; the starter page has no rendered controls or scrollable demonstration.

## Responsive regression check

From the repository root, run:

```sh
node tests/course/r57-t042.mjs
```

The Playwright check serves this static page locally, opens a fresh browser context at 360×800 and 1280×800, and checks the visible prompt, content order, control presence, viewport bounds, horizontal overflow, and browser errors. It saves screenshots and actual measurements under `work/R57-T042/`. Node.js, the repository's Playwright dependency, and its installed Chromium browser are required.
