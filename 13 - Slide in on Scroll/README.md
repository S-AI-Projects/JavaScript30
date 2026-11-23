# Slide in on Scroll

Open `index-START.html` through a local HTTP server to explore the scroll-triggered image animation. When an image request fails, the page shows a readable fallback in its place; the fallback clears if the same image later loads successfully.

## Browser regression

From the repository root, run `npm ci` once and install Chromium with `npx playwright install chromium`, then run `npm run test:course:r57-t043` (or `node tests/course/r57-t043.mjs`). The check starts and stops its own local server and runs with Playwright Chromium. It uses local image fixtures, including a deliberate 404, so the result does not depend on Unsplash.
