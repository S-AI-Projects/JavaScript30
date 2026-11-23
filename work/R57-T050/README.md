# R57-T050 evidence

## Baseline

The starter `23 - Speech Synthesis/index-START.html` shows the Voiceinator heading, a placeholder voice option, rate and pitch sliders, default text, and Speak/Stop buttons. Its script declares controls but has no event bindings. The test records this initial DOM and layout. The finished page is used as the interaction reference.

## Changed behavior verified

The test supplies deterministic English and French voice fixtures and stubs `SpeechSynthesisUtterance`/`speechSynthesis`, so no audio is played. It checks that only English voices appear, choosing Amy queues an utterance with the selected voice, Speak queues exactly one more utterance, and Stop cancels without speaking again.

For the mutation check, the test serves an in-memory copy with the Speak click binding replaced by a no-op. It asserts that the same Speak behavior fails with `0 !== 1`, then verifies that this failure is the expected reason for rejecting the broken fixture. No mutation is written to the repository source.

## Run and evidence

Run `node tests/course/r57-t050.mjs` from the repository root. `results.json` records inputs, expected and actual results, the mutation failure, tool versions, browser errors, and cleanup status. The screenshots record the starter baseline and finished controls after interaction.
