# R57-T027 Results

## Test command

`node tests/course/r57-t027.mjs`

## Entry point

`18 - Adding Up Times with Reduce/index-START.html`

## Setup

From the repository root:

`python3 -m http.server 8000`

The page is opened at:

`http://127.0.0.1:8000/18%20-%20Adding%20Up%20Times%20with%20Reduce/index-START.html`

## Baseline behavior

The START page rendered 58 video rows containing `data-time` values, but the total duration was not displayed in the page.

## Changed behavior

The page now places the rendered example inside `<main>` and displays the calculated total below the video list.

## Expected

- 58 video rows are present.
- The calculated total is `4 hours, 58 minutes, 58 seconds`.
- The total-time result is visibly rendered.
- No unexpected browser page errors occur.

## Actual

- Main region: PASS.
- Video rows: PASS — 58.
- Total time: PASS — 4 hours, 58 minutes, 58 seconds.
- Layout: PASS — total-time result is visibly rendered.
- Page errors: PASS — 0.

## Result

`R57-T027 regression checks passed.`

## Evidence

- `baseline.png` — START page before the change.
- `changed.png` — page after the total-time result was added.
- `tool-versions.txt` — Node.js, Playwright, and Python versions.
