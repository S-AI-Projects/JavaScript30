# Countdown Timer

## Keyboard regression check

From the repository root, run `npm install`, install Playwright Chromium with `npx playwright install chromium`, then run `node tests/course/r57-t041.mjs`. The test serves this static example locally, launches a fresh Chromium context, and checks skip navigation, Tab order, visible focus, keyboard activation, custom form submission, and unexpected page errors.
