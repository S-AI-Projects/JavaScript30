# Speech Synthesis

## Run the lesson

From the repository root, start a local static server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/23%20-%20Speech%20Synthesis/index-START.html` to work through the exercise or `index-FINISHED.html` for the completed reference. The page lists available English voices, lets you select rate and pitch, and uses **Speak** and **Stop** to control the current utterance.

The browser regression stubs the browser's speech synthesis API, so the check verifies voice selection, queued utterances, and cancellation without producing audio or relying on device voices.

## Run the browser check

From the repository root:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t050.mjs
```

The check also serves a temporary copy with the Speak event binding deliberately replaced by a no-op. The assertion must reject that fixture because clicking **Speak** queues no utterance. The mutation is never written to the lesson files. Results and screenshots are saved under `work/R57-T050/`.
