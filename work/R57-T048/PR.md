## Summary

- Add an isolated plain-text rendering companion because the video lesson has no text entry control.
- Keep the video speed lesson unchanged and document the text-only rendering contract.
- Add Playwright coverage for the baseline video layout and a string containing markdown image syntax plus HTML with an event handler.

## Check

Run `node tests/course/r57-t048.mjs`. It asserts literal text, zero injected elements, no handler execution or browser errors, and saves evidence under `work/R57-T048/`.
