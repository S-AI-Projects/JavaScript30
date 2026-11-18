# Countdown Timer

## Keyboard regression check

This page links `scripts-START.js`, which is intentionally empty in the course starter. From the repository root, run `npm install`, install Playwright Chromium with `npx playwright install chromium`, then run `node tests/course/r57-t041.mjs`. The test serves the static example locally in a fresh Chromium context and checks skip navigation, natural Tab order, visible focus on each control, Enter activation of a preset button and the custom form, and unexpected page errors. It does not assert countdown updates because the linked starter script does not implement them.
