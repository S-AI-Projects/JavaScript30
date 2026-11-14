# 28 - Video Speed Controller

This project implements an interactive UI for adjusting HTML5 video playback speed via an interactive scrubber bar.

## Responsive Layout Protection (R57-T012)

The layout is protected across mobile and desktop viewport widths:
- **Mobile (360×800):** The container `.wrapper` scales to `95%` width, and `<video>` adjusts dynamically to `calc(100% - 60px)` with `height: auto`, ensuring the side-by-side `.speed` control remains fully accessible and on-screen without any horizontal overflow (`scrollWidth <= 360px`).
- **Desktop (1280×800):** The container retains its clean centered design bounded by `max-width: 850px` with no horizontal overflow.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t012.mjs
```

The test verifies:
1. HTTP 200 response on page load.
2. Zero horizontal overflow at 360×800 (`scrollWidth <= 360`).
3. Zero horizontal overflow at 1280×800 (`scrollWidth <= 1280`).
4. Visibility and non-zero bounding dimensions of `<video>` and `.speed` at both widths.
5. No clipped or zero-dimension controls.
6. Captures screenshots for visual verification at both viewports.
7. Zero unhandled console/page errors.
