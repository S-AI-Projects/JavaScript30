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

const evidenceDir = path.join(repoRoot, 'work', 'R57-T022');
const port = 8000;
const baseUrl = `http://127.0.0.1:${port}`;
const pageUrl =
  `${baseUrl}/01%20-%20JavaScript%20Drum%20Kit/index-START.html`;

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

  await waitForServer(pageUrl);

  browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '360x800', width: 360, height: 800 },
    { name: '1280x800', width: 1280, height: 800 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    const page = await context.newPage();
    const pageErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto(pageUrl, {
      waitUntil: 'networkidle',
    });

    const result = await page.evaluate(() => {
      const keys = [...document.querySelectorAll('.key')];
      const audios = [...document.querySelectorAll('audio')];

      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        keyCount: keys.length,
        keyOrder: keys.map((key) => key.dataset.key),
        keyBounds: keys.map((key) => {
          const rect = key.getBoundingClientRect();

          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        }),
        audioCount: audios.length,
        audioSources: audios.map((audio) => audio.getAttribute('src')),
      };
    });

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors at ${viewport.name}: ${pageErrors
        .map((error) => error.message)
        .join('; ')}`
    );

    assert.equal(
      result.keyCount,
      9,
      `Expected 9 drum keys at ${viewport.name}`
    );

    assert.deepEqual(
      result.keyOrder,
      ['65', '83', '68', '70', '71', '72', '74', '75', '76'],
      `Drum key order changed at ${viewport.name}`
    );

    assert.equal(
      result.audioCount,
      9,
      `Expected 9 audio elements at ${viewport.name}`
    );

    assert.ok(
      result.audioSources.every((src) => src && src.startsWith('sounds/')),
      `Every audio element should reference a local sound at ${viewport.name}`
    );

    assert.ok(
      result.scrollWidth <= result.clientWidth,
      `Unexpected horizontal overflow at ${viewport.name}: ` +
        `${result.scrollWidth}px scroll width vs ${result.clientWidth}px viewport`
    );

    assert.ok(
      result.keyBounds.every(
        (rect) =>
          rect.left >= 0 &&
          rect.right <= viewport.width &&
          rect.top >= 0 &&
          rect.bottom <= viewport.height
      ),
      `A drum key is clipped outside the viewport at ${viewport.name}`
    );

    await page.screenshot({
      path: path.join(
        evidenceDir,
        `changed-${viewport.name}.png`
      ),
      fullPage: true,
    });

    console.log(
      `${viewport.name}: PASS — ` +
        `scrollWidth=${result.scrollWidth}, ` +
        `clientWidth=${result.clientWidth}, ` +
        `keys=${result.keyCount}, ` +
        `audios=${result.audioCount}`
    );

    await context.close();
  }

  console.log('R57-T022 regression checks passed.');
} finally {
  if (browser) {
    await browser.close();
  }

  if (server) {
    server.kill('SIGTERM');
  }
}