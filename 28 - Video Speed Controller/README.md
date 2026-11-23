# Video Speed Controller

## Run the video lesson

Open `index-START.html` to work on the speed-controller exercise or `index-FINISHED.html` for the completed demo. The finished page uses the `.speed` track to set video playback rate as the pointer moves vertically over the track. The video clip and background image are loaded from the URLs in the page and need network access.

## Plain text rendering companion

The video lesson has no text input. `text-rendering.html` is a separate, isolated companion for demonstrating safe display of user-provided text without changing the video controls. Type or paste a string into **Text to display**; the preview shows the same characters literally. For example, `[image](https://github.com/S-AI-Projects/JavaScript30/issues/x)` appears as text and does not become an image or link. HTML markup is also displayed literally. The preview uses `textContent`; it does not support rich HTML.

## Run the browser check

From the repository root:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t048.mjs
```

The regression check serves both pages locally, uses local fixtures for the video page's background and icon, and omits its remote clip request while checking video/control layout. It then verifies the companion's literal text behavior. Results and screenshots are saved under `work/R57-T048/`.
