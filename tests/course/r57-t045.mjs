import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = '14 - JavaScript References VS Copying/index-START.html';
const fixtureDir = path.join(repoRoot, 'tests/course/fixtures');
const baselineHtml = execFileSync('git', ['show', `HEAD:${pagePath}`], { cwd: repoRoot, encoding: 'utf8' });
const currentHtml = await readFile(path.join(repoRoot, pagePath), 'utf8');
const favicon = await readFile(path.join(repoRoot, '14 - JavaScript References VS Copying/favicon.svg'));
const deterministicCss = await readFile(path.join(fixtureDir, 'deterministic.css'), 'utf8');
const checks = {
  inputs: { page: pagePath, viewport: '1440x900', deviceScaleFactor: 1, locale: 'en-US', fontFixture: 'tests/course/fixtures/deterministic.css', imageFixture: '14 - JavaScript References VS Copying/favicon.svg', baselineExternalRequest: 'fav.farm favicon fulfilled from the local fixture' },
  expected: { players: ['Wes', 'Sarah', 'Ryan', 'Poppy'], person: { name: 'Wes Bos', age: 80 }, visibleText: '', bodyElementChildren: ['SCRIPT'], viewport: { width: 1440, height: 900 }, fontFamily: 'Arial, sans-serif', faviconRequests: 1, changedPageFaviconPath: 'favicon.svg', faviconDimensions: { width: 32, height: 32 }, pageErrors: [], consoleErrors: [], identicalFreshContextState: true },
  baseline: {}, actual: {}, tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(repoRoot, 'node_modules/playwright/package.json'), 'utf8')).version }
};
let server;
let browser;
let baselineContext;
let actualContext;
let actualPage;
let localFaviconRequests = 0;

async function inspectPage(page, url, routeCounts, errors) {
  await page.route('https://fav.farm/**', async route => {
    routeCounts.favicon += 1;
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: favicon });
  });
  const response = await page.goto(url, { waitUntil: 'load' });
  assert.equal(response.status(), 200, 'baseline page is served locally');
  await page.addStyleTag({ content: deterministicCss });
  const snapshot = await page.evaluate(() => ({
    title: document.title,
    visibleText: document.body.innerText,
    bodyElementChildren: [...document.body.children].map(element => element.tagName),
    players: eval('players'),
    person: eval('person'),
    viewport: { width: innerWidth, height: innerHeight },
    fontFamily: getComputedStyle(document.documentElement).fontFamily,
    bodyBounds: (() => { const { width, height, x, y } = document.body.getBoundingClientRect(); return { width, height, x, y }; })(),
    documentBounds: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
  }));
  const faviconLoaded = await page.evaluate(async () => {
    const image = new Image();
    const result = new Promise((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
    });
    image.src = document.querySelector('link[rel="icon"]').href;
    return result;
  });
  return { snapshot, faviconLoaded, pageErrors: [...errors.page], consoleErrors: [...errors.console] };
}

async function watchErrors(page) {
  const errors = { page: [], console: [] };
  page.on('pageerror', error => errors.page.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  return errors;
}

try {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/baseline.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(baselineHtml); return;
    }
    if (pathname === '/index-START.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(currentHtml); return;
    }
    if (pathname === '/favicon.svg') {
      localFaviconRequests += 1;
      response.writeHead(200, { 'content-type': 'image/svg+xml' }); response.end(favicon); return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  checks.tools.chromium = browser.version();

  baselineContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  const baselinePage = await baselineContext.newPage();
  const baselineErrors = await watchErrors(baselinePage);
  const baselineRequests = { favicon: 0 };
  const baseline = await inspectPage(baselinePage, `${baseURL}/baseline.html`, baselineRequests, baselineErrors);
  baseline.faviconRequests = baselineRequests.favicon;
  checks.baseline = baseline;
  assert.deepEqual(baseline.snapshot.players, checks.expected.players, 'baseline teaching example exposes the expected players array');
  assert.deepEqual(baseline.snapshot.person, checks.expected.person, 'baseline teaching example exposes the expected person object');
  assert.equal(baseline.snapshot.visibleText, '', 'baseline is a script-only page with no visible text');
  assert.deepEqual(baseline.snapshot.bodyElementChildren, checks.expected.bodyElementChildren, 'baseline body contains only the lesson script');
  assert.deepEqual(baseline.snapshot.viewport, checks.expected.viewport, 'baseline uses the locked viewport');
  assert.equal(baseline.snapshot.fontFamily, checks.expected.fontFamily, 'baseline uses the font fixture');
  assert.equal(baselineRequests.favicon, 1, 'baseline favicon request is fulfilled by the local fixture');
  assert.deepEqual(baseline.faviconLoaded, checks.expected.faviconDimensions, 'baseline favicon fixture loads at its expected dimensions');
  assert.deepEqual(baselineErrors.page, [], 'baseline must not emit uncaught page errors');
  assert.deepEqual(baselineErrors.console, [], 'baseline must not emit console errors');

  actualContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  actualPage = await actualContext.newPage();
  const actualErrors = await watchErrors(actualPage);
  const actualRequests = { favicon: 0 };
  await actualPage.route('https://fav.farm/**', async route => {
    actualRequests.favicon += 1;
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: favicon });
  });
  await actualPage.goto(`${baseURL}/index-START.html`, { waitUntil: 'load' });
  await actualPage.addStyleTag({ content: deterministicCss });
  const actualFaviconLoaded = await actualPage.evaluate(async () => {
    const image = new Image();
    const result = new Promise((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
    });
    image.src = document.querySelector('link[rel="icon"]').href;
    return result;
  });
  actualRequests.favicon = localFaviconRequests;
  const actualSnapshot = await actualPage.evaluate(() => ({
    title: document.title,
    visibleText: document.body.innerText,
    bodyElementChildren: [...document.body.children].map(element => element.tagName),
    players: eval('players'),
    person: eval('person'),
    viewport: { width: innerWidth, height: innerHeight },
    fontFamily: getComputedStyle(document.documentElement).fontFamily,
    bodyBounds: (() => { const { width, height, x, y } = document.body.getBoundingClientRect(); return { width, height, x, y }; })(),
    documentBounds: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
  }));
  checks.actual = { snapshot: actualSnapshot, faviconPath: await actualPage.locator('link[rel="icon"]').getAttribute('href'), faviconLoaded: actualFaviconLoaded, faviconRequests: actualRequests.favicon, pageErrors: actualErrors.page, consoleErrors: actualErrors.console };

  assert.deepEqual(actualSnapshot, baseline.snapshot, 'two fresh contexts produce the same asserted DOM and layout');
  assert.equal(actualSnapshot.visibleText, checks.expected.visibleText, 'current page has the expected rendered content');
  assert.deepEqual(actualSnapshot.bodyElementChildren, checks.expected.bodyElementChildren, 'current page body contains only the lesson script');
  assert.deepEqual(actualSnapshot.viewport, checks.expected.viewport, 'current page uses the locked viewport');
  assert.equal(checks.actual.faviconPath, checks.expected.changedPageFaviconPath, 'current page references its local icon fixture');
  assert.equal(actualRequests.favicon, 1, 'actual page favicon request is fulfilled by the local fixture');
  assert.deepEqual(actualFaviconLoaded, checks.expected.faviconDimensions, 'local favicon fixture loads with its expected intrinsic dimensions');
  assert.equal(actualSnapshot.fontFamily, 'Arial, sans-serif', 'font fixture locks the computed font stack');
  assert.deepEqual(actualErrors.page, [], 'actual page must not emit uncaught page errors');
  assert.deepEqual(actualErrors.console, [], 'actual page must not emit console errors');

  const workDir = path.join(repoRoot, 'work/R57-T045');
  await mkdir(workDir, { recursive: true });
  await actualPage.screenshot({ path: path.join(workDir, 'page.png'), fullPage: true });
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  checks.error = error?.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {};
  if (baselineContext) await baselineContext.close();
  cleanup.baselineContextClosed = !baselineContext || baselineContext.pages().every(page => page.isClosed());
  if (actualContext) await actualContext.close();
  cleanup.actualContextClosed = !actualContext || actualContext.pages().every(page => page.isClosed());
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  checks.cleanup = cleanup;
  const workDir = path.join(repoRoot, 'work/R57-T045');
  await mkdir(workDir, { recursive: true });
  await writeFile(path.join(workDir, 'results.json'), `${JSON.stringify(checks, null, 2)}\n`);
}
