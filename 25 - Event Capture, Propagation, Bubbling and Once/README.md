# 25 - Event Capture, Propagation, Bubbling and Once

Demonstration of DOM event bubbling, capturing phases, and `{ once: true }` listener options.

## Keyboard Interaction & Accessibility (R57-T040)

- **Skip to Content Link**: An accessible skip link (`.skip-link`) allows keyboard users to immediately jump past top-level navigation to the main demonstrated `#main-content` container.
- **Sequential Tab Traversal**: All interactive controls (`.skip-link`, `.one`, `.two`, `.three`, and `#once-btn`) participate in logical DOM order traversal using standard `tabindex="0"`. No positive `tabindex` values are introduced.
- **Visible Focus Outlines**: High-contrast outline styles (`outline: 4px solid #000000; outline-offset: -4px;`) ensure clear focus feedback across all interactive regions without disrupting demonstrated CSS padding or nesting.
- **Keyboard Activation**: Both `Enter` and `Space` activate interactive targets identically to pointer clicks.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Suite
```bash
node tests/course/r57-t040.mjs
```
