# CSS Variables

## Page entry point

Start with [`index-START.html`](index-START.html). It contains the three controls for spacing, blur, and base color, but leaves the CSS variables and JavaScript update logic as the lesson exercise. [`index-FINISHED.html`](index-FINISHED.html) is the completed reference for comparing the behavior.

## Preview the pages

From the repository root, start Python's static server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/03%20-%20CSS%20Variables/index-START.html` for the exercise or `http://localhost:8000/03%20-%20CSS%20Variables/index-FINISHED.html` for the working reference. No build step is needed.

## Complete interaction

On the finished reference, set **Spacing** to `50`, **Blur** to `4`, and **Base Color** to `#336699`. The expected results are `--spacing: 50px`, `--blur: 4px`, and `--base: #336699`; the image gets `50px` padding and `blur(4px)`, and both its background and the highlighted `JS` heading text change to the selected blue. The START page intentionally does not update these values until you implement the exercise.

## Run the browser check

From the repository root, install the pinned test dependency and Chromium, then run:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t047.mjs
```

The check verifies the exercise state and performs the full interaction on the finished reference using local image and font fixtures. Results and screenshots are saved under `work/R57-T047/`.
