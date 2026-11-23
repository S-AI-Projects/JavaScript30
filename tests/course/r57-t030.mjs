import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 8765;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PAGE_PATH = '/30%20-%20Whack%20A%20Mole/index-START.html';

async function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Server did not become ready: ${url}`);
}

async function checkStartBehavior(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${BASE_URL}${PAGE_PATH}`, { waitUntil: 'networkidle' });
  await page.locator('button').click();
  await page.waitForTimeout(100);

  return {
    moleCount: await page.locator('.hole.up').count(),
    score: await page.locator('.score').innerText(),
    errors
  };
}

const server = spawn(
  'python3',
  ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { stdio: 'ignore' }
);

let browser;

try {
  await waitForServer(`${BASE_URL}/`);

  const source = await readFile(
    '30 - Whack A Mole/index-START.html',
    'utf8'
  );

  browser = await chromium.launch({ headless: true });

  // Correct page: Start! must produce a visible mole with no page errors.
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const result = await checkStartBehavior(page);

    assert.equal(
      result.moleCount,
      1,
      'Start! should make exactly one mole visible immediately'
    );
    assert.deepEqual(
      result.errors,
      [],
      'Correct page must have no unexpected page errors'
    );

    console.log('Correct page: PASS');
    console.log(`  Moles up after Start: ${result.moleCount}`);
    console.log(`  Initial score: ${result.score}`);
    console.log(`  Page errors: ${result.errors.length}`);

    await context.close();
  }

  // Temporary fixture: deliberately remove the button event binding.
  const brokenSource = source.replace(
    '<button onClick="startGame()">Start!</button>',
    '<button>Start!</button>'
  );

  assert.notEqual(
    brokenSource,
    source,
    'Temporary fixture mutation must change the button binding'
  );

  const brokenContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  await brokenContext.route(`${BASE_URL}${PAGE_PATH}`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: brokenSource
    });
  });

  const brokenPage = await brokenContext.newPage();
  const brokenResult = await checkStartBehavior(brokenPage);

  assert.equal(
    brokenResult.moleCount,
    0,
    'Broken button binding must not make a mole visible'
  );
  assert.deepEqual(
    brokenResult.errors,
    [],
    'Broken event-binding fixture should fail by behavior, not by an unexpected page error'
  );

  console.log('Broken event-binding fixture: PASS');
  console.log(`  Moles up after Start: ${brokenResult.moleCount}`);
  console.log(`  Page errors: ${brokenResult.errors.length}`);

  await brokenContext.close();

  console.log('R57-T030 regression checks passed.');
} finally {
  await browser?.close();
  server.kill();
}
