## Summary

- Add Playwright coverage for the Speech Synthesis starter baseline and the finished lesson interactions.
- Stub the speech synthesis API and voices so no audio or real device voices are required.
- Add a temporary no-op Speak-binding mutation and prove the behavioral assertion rejects it.
- Document the lesson entry point and test command.

## Check

Run `node tests/course/r57-t050.mjs`. It checks voice selection, Speak, Stop, layout, page errors, and the deliberate event-binding mutation. Evidence is saved under `work/R57-T050/`.
