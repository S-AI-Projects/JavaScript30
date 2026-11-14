# 27 - Click and Drag

This project demonstrates an interactive horizontal image gallery scrollable via mouse click-and-drag interactions.

## Feature Support & Fallbacks (R57-T016)

- **Feature-Present Path:** When mouse click-and-drag interaction is supported, mousedown, mousemove, and mouseup/mouseleave update `scrollLeft` smoothly with active visual feedback (`.items.active`).
- **Feature-Absent / Fallback Path:** For environments where drag events are unsupported or disabled, an informative status banner is displayed (`Drag interaction disabled or unsupported. Use arrow buttons to scroll.`) and accessible navigation controls (`.prev-btn` and `.next-btn`) allow full scroll navigation.
- **CSS @supports Fallback:** Includes progressive CSS enhancement using `@supports` checks for properties such as `user-select`.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t016.mjs
```

The test verifies:
1. HTTP 200 response on page load.
2. Feature-present path: clicking and dragging with the mouse scrolls `.items` and changes `scrollLeft`.
3. Feature-absent path: stubbing drag as unsupported displays the fallback notification banner.
4. Fallback navigation buttons (`.prev-btn` / `.next-btn`) operate scroll behavior properly.
5. Captures screenshots for both supported drag and fallback states.
6. Zero unhandled console/page errors.
