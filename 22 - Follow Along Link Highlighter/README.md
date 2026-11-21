# 22 - Follow Along Link Highlighter

A dynamic pill highlighter that smoothly animates and follows hovered or focused hyperlinks across the page.

## Repeat Initialization & DOM Lifecycle (R57-T033)

- **Idempotent Initialization**: Encapsulated in `initFollowAlongLinks()`. Re-initializing multiple times reuses the existing `.highlight` element rather than duplicating DOM nodes (`document.querySelectorAll('.highlight').length === 1`).
- **Listener Teardown via AbortController**: Listener registration uses an `AbortController` signal. Calling `initFollowAlongLinks()` repeatedly automatically aborts previous listeners before attaching new ones, preventing duplicate event handler execution.
- **Teardown Support**: Exposes `destroyFollowAlongLinks()` which aborts active event listeners and cleanly removes `.highlight` from the DOM.
- **Keyboard Navigation**: In addition to `mouseenter`, supports `focus` so keyboard users navigating via Tab activate the highlighter.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t033.mjs
```
