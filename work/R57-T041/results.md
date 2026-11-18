# R57-T041 browser check

## Inputs and setup

- Target: `29 - Countdown Timer/index.html`, `style.css`, and linked `scripts-START.js`.
- Source inspected: `scripts-START.js` is empty; the page is a static demo. `scripts-FINISHED.js` is not linked by the page.
- Browser: a new Playwright Chromium browser context served over the check's local HTTP server.
- Keyboard sequence: Tab to skip link; Enter to activate it; reload; Tab through skip link, five preset buttons, and custom minutes input; Enter on the first preset; enter `2` in the input and press Enter on its form.
- External requests are blocked by the check. No hardware or permission-backed APIs are used.

## Baseline before the page changes

- The page had no skip link or main landmark.
- `.timer__button:focus` shared a hover rule that removed the outline with `outline: 0`.
- The custom input had no explicit visible focus style.
- The linked starter script is empty, so neither the preset buttons nor custom form update the countdown display.
- Baseline expectations: no skip navigation; keyboard focus lacks a guaranteed visible treatment; native button and form keyboard activation remain available, but no countdown result is expected.

## Updated expected versus actual

- Expected: skip link is the first Tab stop, becomes visible on focus, and Enter navigates to `#main` and focuses the main landmark. Actual: all assertions pass.
- Expected: five preset buttons and the custom input are reached in natural order; each focus is visibly styled; no control has positive `tabindex`. Actual: all assertions pass.
- Expected: Enter dispatches a trusted activation click on the first preset and submits the custom form. Actual: both event effects are asserted and pass. The custom form submit is intercepted by the test so the static-page check does not navigate away.
- Expected: no unexpected page errors. Actual: empty page-error list.
- Check: `node tests/course/r57-t041.mjs` — exit status 0; output `PASS: skip link, Tab order, visible focus, preset activation, custom submission, and page errors`.
- Failure behavior: a prior run with an incorrect root path failed with a nonzero assertion timeout; the corrected check passes.

## Tool versions

- Node.js: v26.13.0
- npm: 11.20.0
- Playwright: 1.65.1
- Chromium: Playwright Chromium v1255 (Chrome for Testing 159.0.8154.6)
