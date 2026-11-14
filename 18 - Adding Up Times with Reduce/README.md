# 18 - Adding Up Times with Reduce

## Overview
This exercise calculates the cumulative duration across a playlist of videos using Array methods (`map`, `reduce`, `split`, `parseFloat`) and converts the total seconds into formatted `HH:MM:SS`.

## Safe Text Rendering & Dynamic Summary Companion
An isolated companion summary and addition interface was implemented:
- **Total Time Display**: Dynamically computes and displays the sum of all video times in `#total-time-display`.
- **Safe Custom Video Entry**: Allows appending custom videos while strictly rendering user input via `textContent`.
- **XSS & Injection Protection**: Strings containing HTML entities, scripts, or event handlers (`<script>`, `<img onerror=...>`, etc.) are rendered purely as text literals, preventing unauthorized element injection or script execution.

## Running Tests
Run the Playwright regression test suite:
```bash
node tests/course/r57-t018.mjs
```
