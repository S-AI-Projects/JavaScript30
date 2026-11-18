# R57-T041 browser check

## Inputs

- Page: `29 - Countdown Timer/index.html`, including its linked stylesheet and `scripts-START.js`.
- Browser: fresh Playwright Chromium context; page loaded from the check's local HTTP server.
- Keyboard input: Tab through skip link, five preset buttons, and custom minutes field; Enter on skip link, first preset, and custom form after entering `2`.

## Baseline (before changes)

- HTML had no skip link or main landmark.
- `.timer__button:focus` shared a hover rule that set `outline: 0`, removing the native focus outline.
- The input had no explicit focus treatment.
- Expected baseline: skip navigation absent; keyboard focus on buttons lacks a visible outline.

## Updated expected versus actual

- Expected: skip link is first in Tab order, becomes visible on focus, and Enter moves focus to `#main`.
- Actual: asserted in Chromium; passes.
- Expected: all five preset buttons and custom minutes input follow in natural order without positive tabindex; buttons and input show visible keyboard focus.
- Actual: asserted in Chromium; passes.
- Expected: Enter on the first preset renders `0:20`; Enter on custom value `2` renders `2:00` and resets the field.
- Actual: asserted in Chromium; passes.
- Expected: no unexpected page errors.
- Actual: empty page error list; passes.
- Test command: `node tests/course/r57-t041.mjs` (exit status 0).

## Tool versions

- Node.js: v26.13.0
- npm: 11.20.0
- Playwright: recorded in root `package-lock.json`
- Chromium: Playwright Chromium v1255 (Chrome for Testing 159.0.8154.6)
