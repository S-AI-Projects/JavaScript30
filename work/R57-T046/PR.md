## Summary

- Add feature detection and a readable fallback when link geometry measurement is unavailable.
- Preserve the link highlighter lesson and keep links usable in the unsupported path.
- Add a Playwright regression for baseline behavior, supported hover/layout, unsupported fallback, deterministic fresh contexts, and browser errors.

## Check

Run `node tests/course/r57-t046.mjs`. The check uses local page, font, and icon fixtures and saves expected/actual results plus screenshots under `work/R57-T046/`.
