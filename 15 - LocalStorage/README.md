# LocalStorage

## Run the exercise

From the repository root, start a local static server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/15%20-%20LocalStorage/index-START.html`. The starter shows the Local Tapas heading and form for an item name and submit button; complete the lesson by implementing the list and LocalStorage behavior. `index-FINISHED.html` contains the full reference implementation.

## Motion and keyboard focus

The starter page has no animation or transition. Enabling reduced motion does not hide or disable any content or controls. Use Tab to focus the item field and Add Item button; the focused control gets a dark outline with a yellow outer ring. The regression check verifies the static layout, reduced-motion preference, and visible focus at desktop and narrow viewport widths.

## Run the browser check

From the repository root:

```sh
npm ci
npx playwright install chromium
node tests/course/r57-t049.mjs
```

Results and screenshots are saved under `work/R57-T049/`.
