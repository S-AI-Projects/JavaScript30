import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = '13 - Slide in on Scroll/index-START.html';
const html = await readFile(path.join(repoRoot, pagePath), 'utf8');
const fixture = await readFile(path.join(repoRoot, 'tests/course/fixtures/landscape.svg'));
const checks = {
  inputs: { page: pagePath, failedImageStatus: 404, restoredFixture: 'tests/course/fixtures/landscape.svg', viewport: '1280x900' },
  expected: { baselineFallback: false, baselineScrollReveal: false, changedFallbackVisibleOn404: true, restoredImageWidth: 400, scrollRevealOpacity: '1', scrollAwayOpacity: '0', uncaughtPageErrors: [] },
  baseline: {}, actual: {},
  tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(repoRoot, 'node_modules/playwright/package.json'), 'utf8')).version }
};
let server;
let browser;

try {
  server = createServer((req, res) => {
    if (req.url === '/13%20-%20Slide%20in%20on%20Scroll/index-START.html' || req.url === '/13%20-%20Slide%20in%20on%20Scroll/index-START.html/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.url === '/fixtures/landscape.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
      res.end(fixture);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  checks.tools.chromium = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  let initialFailureUsed = false;
  await page.route('http://unsplash.it/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/400/400' && !initialFailureUsed) {
      initialFailureUsed = true;
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing fixture image' });
    } else {
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fixture });
    }
  });

  // Baseline is the checked-out source before edits (HEAD), rendered in the same fresh context.
  const { execFileSync } = await import('node:child_process');
  const baselineHtml = execFileSync('git', ['show', `HEAD:${pagePath}`], { cwd: repoRoot, encoding: 'utf8' });
  await page.setContent(baselineHtml, { waitUntil: 'load' });
  await page.locator('img').first().evaluate(img => new Promise(resolve => {
    if (img.complete) resolve(); else img.addEventListener('error', resolve, { once: true });
  }));
  await page.locator('.slide-in').nth(2).evaluate(img => img.scrollIntoView());
  await page.waitForTimeout(100);
  const baseline = await page.evaluate(() => ({
    imageCount: document.querySelectorAll('.slide-in').length,
    failedImageHasReadableFallback: Boolean(document.querySelector('.image-fallback')),
    scrollHandlerActive: [...document.querySelectorAll('.slide-in')].some(img => img.classList.contains('active')),
    firstImageNaturalWidth: document.querySelector('.slide-in').naturalWidth
  }));
  checks.baseline = baseline;
  assert.equal(baseline.imageCount, 5, 'baseline should contain the five lesson images');
  assert.equal(baseline.failedImageHasReadableFallback, false, 'baseline documents the missing error state');
  assert.equal(baseline.scrollHandlerActive, false, 'baseline documents that START has no scroll reveal handler');
  assert.equal(baseline.firstImageNaturalWidth, 0, 'baseline fixture must fail to load');

  initialFailureUsed = false;
  await page.goto(`${baseURL}/13%20-%20Slide%20in%20on%20Scroll/index-START.html`, { waitUntil: 'load' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);
  const images = page.locator('.slide-in');
  assert.equal(await images.count(), 5);
  const first = images.first();
  const fallback = page.getByRole('status').filter({ hasText: 'Image unavailable: A landscape photo sliding in from the left' });
  await fallback.waitFor();
  assert.equal(await first.isHidden(), true, 'broken image is hidden while its text fallback is shown');
  assert.equal(await fallback.isVisible(), true);
  const fallbackWidth = await fallback.evaluate(el => getComputedStyle(el).width);
  assert.equal(fallbackWidth, '400px', 'fallback reserves the image width');
  assert.equal(await first.getAttribute('alt'), 'A landscape photo sliding in from the left');
  const fallbackText = await fallback.textContent();

  await first.evaluate((img, src) => { img.src = src; }, `${baseURL}/fixtures/landscape.svg`);
  await first.evaluate(img => img.decode());
  await fallback.waitFor({ state: 'detached' });
  assert.equal(await first.isVisible(), true, 'restored image becomes visible');
  assert.equal(await first.evaluate(img => img.naturalWidth), 400, 'restored fixture loaded at its intrinsic width');
  const scrollTarget = images.nth(4);
  await scrollTarget.evaluate((img, src) => { img.hidden = false; img.src = src; }, `${baseURL}/fixtures/landscape.svg`);
  await scrollTarget.evaluate(img => img.decode());
  assert.equal(await scrollTarget.evaluate(img => getComputedStyle(img).opacity), '0', 'offscreen image begins hidden for the scroll lesson');
  await scrollTarget.scrollIntoViewIfNeeded();
  await page.waitForFunction(el => el.classList.contains('active'), await scrollTarget.elementHandle());
  await page.waitForFunction(el => getComputedStyle(el).opacity === '1', await scrollTarget.elementHandle());
  assert.equal(await scrollTarget.evaluate(el => getComputedStyle(el).opacity), '1', 'scroll event reveals an in-view image');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(el => !el.classList.contains('active'), await scrollTarget.elementHandle());
  await page.waitForFunction(el => getComputedStyle(el).opacity === '0', await scrollTarget.elementHandle());
  assert.equal(await scrollTarget.evaluate(el => getComputedStyle(el).opacity), '0', 'scrolling above the image hides it again');
  assert.deepEqual(pageErrors, [], 'page must not emit uncaught errors');

  checks.actual = {
    imageCount: await images.count(),
    failedImageFallback: { visible: true, text: fallbackText, width: fallbackWidth },
    recoveryRemovedFallback: (await fallback.count()) === 0,
    restoredImageNaturalWidth: await first.evaluate(img => img.naturalWidth),
    revealOpacity: '1',
    hiddenAfterScrollUpOpacity: '0',
    uncaughtPageErrors: pageErrors
  };
  const workDir = path.join(repoRoot, 'work/R57-T043');
  await mkdir(workDir, { recursive: true });
  await page.screenshot({ path: path.join(workDir, 'changed-page.png'), fullPage: true });
  await writeFile(path.join(workDir, 'results.json'), `${JSON.stringify(checks, null, 2)}\n`);
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
