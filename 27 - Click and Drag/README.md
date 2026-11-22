# 27 - Click and Drag

Horizontal gallery scrubber with mouse click-and-drag scrolling momentum.

## Safe Text Rendering (R57-T037)

- **Click-and-Drag Momentum**: Implemented interactive mouse scrolling with `scrollLeft` calculation and active dragging styling.
- **Strict Text Rendering**: A companion item creator (`#custom-item-input` and `#add-item-btn`) demonstrates safe fixture and user text handling.
- **XSS & Injection Protection**: User/fixture inputs are assigned strictly via `element.textContent = rawText`, guaranteeing that input strings containing `<script>`, `<img>`, or raw HTML tags render purely as literal text without creating injected elements or executing event handlers.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t037.mjs
```

