# Countdown Timer

## Keyboard check

This static demo has five preset buttons and a named custom minutes form. Tab reaches every control in document order, the focused button background changes, and the custom input keeps the browser's native focus indicator. A skip link is available as the first Tab stop and moves focus to the timer display.

From the repository root, install the browser check dependency and Chromium, then run the regression:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t041.mjs
```

The example's `scripts-START.js` is intentionally empty, so the check covers native keyboard activation and form submission rather than countdown timing.
