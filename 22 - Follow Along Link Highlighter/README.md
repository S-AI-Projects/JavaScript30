# Follow Along Link Highlighter

## Run the example

Open `index-START.html` in a browser. The example moves a single decorative highlight under the link currently being hovered. If the browser cannot measure element geometry, it displays a readable status message and leaves the links usable.

## Run the regression check

From the repository root, run:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t046.mjs
```

The browser check compares the pinned baseline with the changed page, exercises the supported hover behavior and an unsupported geometry API fixture, and writes its results and screenshots to `work/R57-T046/`.
