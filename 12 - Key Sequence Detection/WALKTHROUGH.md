# Walkthrough — Key Sequence Detection (KONAMI Code)

This walkthrough documents the entry point, setup commands, step-by-step interaction, and expected observable outputs for `12 - Key Sequence Detection`.

## 1. Prerequisites and Setup

1. **Repository & Working Directory**:
   Ensure you are in the repository root:
   ```bash
   cd "/Users/atharvn./SNAI Project/JavaScript30"
   ```

2. **Start Local Static HTTP Server**:
   ```bash
   npx http-server . -p 8080
   ```
   Or start any local server serving the repository root.

3. **Application Entry Point**:
   Open browser at:
   ```
   http://127.0.0.1:8080/12%20-%20Key%20Sequence%20Detection/index-START.html
   ```

## 2. Interactive Reproduction Steps

### Step 1: Initial Page Inspection
- **Action**: Load the application in a fresh browser window.
- **Expected Observation**:
  - The page displays a centered container (`.key-sequence-container`).
  - Heading: "Key Sequence Detector".
  - Buffer display (`#key-buffer`): shows `(awaiting keys...)`.
  - Status indicator (`#key-status`): shows `Status: Waiting for input`.
  - No cornify celebration elements exist in the DOM.

### Step 2: Keystroke Buffer Tracking
- **Action**: Type arbitrary characters, e.g., `h`, `e`, `l`, `l`, `o`.
- **Expected Observation**:
  - `#key-buffer` updates dynamically to display `hello`.
  - `#key-status` displays `Status: Tracking keys...`.
  - The buffer maintains a sliding window capped at the length of the secret code (6 characters).

### Step 3: Trigger Secret Code Detection
- **Action**: Type the secret code `w`, `e`, `s`, `b`, `o`, `s`.
- **Expected Observation**:
  - `#key-buffer` contains `wesbos`.
  - `#key-status` updates to: `🎉 Secret Code Detected! DING DING!`.
  - The status text applies the `.celebration-active` pulse animation.
  - `cornify_add()` executes, inserting dynamic celebration elements into the DOM.

### Step 4: Continued Input Handling
- **Action**: Type subsequent keys.
- **Expected Observation**:
  - The buffer safely slides old keys out and new keys in without throwing any uncaught runtime errors.

## 3. Automated Verification

Run the automated Playwright regression test validating this walkthrough:
```bash
node tests/course/r57-t036.mjs
```
All assertions and steps are executed deterministically.
