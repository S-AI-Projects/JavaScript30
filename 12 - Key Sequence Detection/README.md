# 12 - Key Sequence Detection

Vanilla JavaScript key sequence detection (KONAMI code style easter egg).

## Walkthrough Documentation (R57-T036)

- Detailed prerequisites, step-by-step user interactions, and expected layout observations are published in [WALKTHROUGH.md](./WALKTHROUGH.md).
- Visual UI container `.key-sequence-container` provides live buffer feedback (`#key-buffer`) and status tracking (`#key-status`).
- Successfully detects the secret code (`wesbos`) and triggers visual celebration without uncaught runtime errors.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t036.mjs
```
