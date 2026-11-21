# 11 - Custom Video Player

A custom HTML5 video player with customized controls for play/pause, volume, playback speed, forward/rewind skipping, and a progress scrubber.

## Responsive Layout Protection (R57-T031)

The player layout is protected across mobile (360×800) and desktop (1280×800) viewports:
- **Mobile (360×800):** Viewport meta tag is included. The container `.player` adapts with `width: 100%` and `box-sizing: border-box`. On touch / small viewports (`max-width: 600px`), `.player__controls` are positioned relative with solid background to ensure full visibility and clickability without relying on mouse hover.
- **Desktop (1280×800):** Preserves original centered layout bounded by `max-width: 750px`. Controls slide smoothly on hover and remain accessible via keyboard navigation (`:focus-within`).
- **Overflow & Clipping:** Zero horizontal scrolling (`scrollWidth <= clientWidth`). Video, buttons, and range inputs maintain non-zero bounding dimensions on screen.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Layout Regression Test
```bash
node tests/course/r57-t031.mjs
```
