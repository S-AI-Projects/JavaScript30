# 03 - CSS Variables

This project demonstrates scoped CSS variable updates in real-time via HTML form controls (`#spacing`, `#blur`, and `#base`) using JavaScript.

## Repeat Initialization & Lifecycle Safety (R57-T014)

- **Idempotent Initialization:** The initialization logic is encapsulated in `initCSSVariables()`. Calling it repeatedly cleanly replaces previously registered event listeners using modern standard `AbortController` signals rather than accumulating duplicate listeners.
- **Explicit Cleanup:** Provides `cleanupCSSVariables()` to abort and remove all active listeners and leave zero lingering event handlers, timers, or duplicate DOM nodes.
- **Accurate Style Scoping:** Applies `:root` variables `--base`, `--spacing`, and `--blur` directly to the document root and propagates changes instantly to target elements.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t014.mjs
```

The test verifies:
1. HTTP 200 response on page load.
2. Initial CSS variable values match control defaults.
3. Interactive updates for `#spacing`, `#blur`, and `#base`.
4. Repeated initialization (calling `initCSSVariables()` multiple times) does not duplicate event listeners or update events.
5. Teardown via `cleanupCSSVariables()` removes all listeners.
6. Zero unhandled console/page errors.
