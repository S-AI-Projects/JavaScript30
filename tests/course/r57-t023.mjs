import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const evidenceDir = path.join(repoRoot, 'work', 'R57-T023');
const port = 8000;
const baseUrl = `http://127.0.0.1:${port}`;
const pagePath =
  '/07%20-%20Array%20Cardio%20Day%202/index-START.html';

mkdirSync(evidenceDir, { recursive: true });

async function waitForServer(url, timeout = 10000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Server did not become ready within ${timeout}ms`);
}

let server;
let browser;

try {
  server = spawn(
    'python3',
    ['-m', 'http.server', String(port)],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  await waitForServer(`${baseUrl}${pagePath}`);

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error);
  });

  await page.goto(`${baseUrl}${pagePath}`, {
    waitUntil: 'networkidle',
  });

  const normalResult = await page.locator('#comment-result').textContent();

  assert.equal(
    normalResult,
    'Found comment: Super good',
    'Normal fixture should display the matching comment'
  );

  await page.screenshot({
    path: path.join(evidenceDir, 'changed-valid.png'),
    fullPage: true,
  });
  await page.goto(`${baseUrl}${pagePath}`, {
  waitUntil: 'networkidle',
});

const recoveredResult = await page.locator('#comment-result').textContent();

assert.equal(
  recoveredResult,
  'Found comment: Super good',
  'Page should recover when the valid fixture is restored'
);

console.log(
  'Recovery: PASS — valid comment rendered after restoring the normal fixture.'
);

  await page.goto(`${baseUrl}${pagePath}?fixture=empty`, {
    waitUntil: 'networkidle',
  });

  const emptyResult = await page.locator('#comment-result').textContent();

  assert.equal(
    emptyResult,
    'No matching comment found.',
    'Empty fixture should display a meaningful fallback'
  );

  assert.equal(
    pageErrors.length,
    0,
    `Unexpected page errors: ${pageErrors
      .map((error) => error.message)
      .join('; ')}`
  );

  await page.screenshot({
    path: path.join(evidenceDir, 'changed-empty.png'),
    fullPage: true,
  });

  console.log(
    'Normal fixture: PASS — matching comment rendered.'
  );

  console.log(
    'Empty fixture: PASS — fallback message rendered.'
  );

  console.log(
    'Page errors: PASS — no unexpected errors.'
  );

  console.log('R57-T023 regression checks passed.');

  await context.close();
} finally {
  if (browser) {
    await browser.close();
  }

  if (server) {
    server.kill('SIGTERM');
  }
}