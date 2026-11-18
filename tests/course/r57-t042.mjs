import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = path.join(root, 'work/R57-T042');
const pagePath = path.join(root, '04 - Array Cardio Day 1/index-START.html');
const viewports = [{ width: 360, height: 800 }, { width: 1280, height: 800 }];
const expectedPrompt = 'Psst: have a look at the JavaScript Console 💁';
let server;
let browser;
const results = [];

try {
  await mkdir(evidenceDir, { recursive: true });
  const html = await readFile(pagePath);
  server = createServer((request, response) => {
    if (request.url !== '/04-array-cardio-day-1/') {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/04-array-cardio-day-1/`;
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.route('https://fav.farm/**', route => route.fulfill({ status: 204, body: '' }));
    const response = await page.goto(url, { waitUntil: 'load' });
    assert.equal(response?.status(), 200, 'the example should be served successfully');

    const actual = await page.evaluate(() => {
      const paragraph = document.querySelector('body > p');
      const rect = paragraph.getBoundingClientRect();
      const style = getComputedStyle(paragraph);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        bodyChildren: [...document.body.children].map(element => element.tagName),
        visibleText: document.body.innerText,
        controls: document.querySelectorAll('button, input, select, textarea, a[href]').length,
        prompt: {
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
          display: style.display, visibility: style.visibility,
        },
        linkedStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
        externalScripts: document.querySelectorAll('script[src]').length,
        exerciseScriptPresent: document.querySelector('body > script') !== null,
      };
    });
    assert.deepEqual(actual.viewport, viewport);
    assert.equal(actual.documentWidth, viewport.width, 'the page must not overflow horizontally');
    assert.deepEqual(actual.bodyChildren, ['P', 'SCRIPT'], 'keep the console prompt before the non-rendering exercise script');
    assert.equal(actual.visibleText.trim(), expectedPrompt, 'the teaching prompt must remain visible');
    assert.equal(actual.controls, 0, 'this example has no interactive controls to clip');
    assert.equal(actual.exerciseScriptPresent, true, 'keep the inline array exercises in the page');
    assert.equal(actual.linkedStylesheets, 0);
    assert.equal(actual.externalScripts, 0);
    assert(actual.prompt.left >= 0 && actual.prompt.right <= viewport.width, 'the prompt must fit inside the viewport');
    assert(actual.prompt.top >= 0 && actual.prompt.bottom <= viewport.height, 'the prompt must be visible without vertical clipping');
    assert.notEqual(actual.prompt.display, 'none');
    assert.notEqual(actual.prompt.visibility, 'hidden');
    await page.screenshot({ path: path.join(evidenceDir, `${viewport.width}x${viewport.height}.png`), fullPage: true });
    assert.deepEqual(pageErrors, [], 'unexpected page errors are failures');
    assert.deepEqual(consoleErrors, [], 'unexpected browser console errors are failures');
    results.push({ viewport, expected: { visibleText: expectedPrompt, documentWidth: viewport.width, bodyChildren: ['P', 'SCRIPT'], controls: 0 }, actual });
    await context.close();
  }

  await writeFile(path.join(evidenceDir, 'actual-results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`R57-T042 passed at ${viewports.map(({ width, height }) => `${width}x${height}`).join(' and ')}.`);
} catch (error) {
  await writeFile(path.join(evidenceDir, 'actual-results.json'), `${JSON.stringify({ results, failure: error.stack ?? String(error) }, null, 2)}\n`).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server?.listening) await new Promise(resolve => server.close(resolve));
}
