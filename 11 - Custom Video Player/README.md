# Custom Video Player

Open `index.html` through a local HTTP server. The controls toggle playback, skip by the button's data amount, update volume and playback rate, and scrub the progress bar. Initialization is guarded so loading the player script again does not attach duplicate handlers.

## Browser regression

From the repository root, run `npm ci`, then install the Playwright browser with `npx playwright install chromium`. Run the check with `node tests/course/r57-t044.mjs`. It initializes the page twice, repeats player interactions, uses fresh browser contexts, stubs media playback for deterministic checks, and cleans up the browser and local server.
