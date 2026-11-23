import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exampleDir = '22 - Follow Along Link Highlighter';
const pagePath = `${exampleDir}/index-START.html`;
const baselineHtml = execFileSync('git', ['show', `HEAD:${pagePath}`], { cwd: repoRoot, encoding: 'utf8' }).replace('href="style.css"', 'href="baseline-style.css"').replace('https://fav.farm/🔥', 'fixture.svg');
const baselineCss = execFileSync('git', ['show', `HEAD:${exampleDir}/style.css`], { cwd: repoRoot, encoding: 'utf8' });
const currentHtml = (await readFile(path.join(repoRoot, pagePath), 'utf8')).replace('https://fav.farm/🔥', 'fixture.svg');
const currentCss = await readFile(path.join(repoRoot, exampleDir, 'style.css'), 'utf8');
const fontCss = await readFile(path.join(repoRoot, 'tests/course/fixtures/deterministic.css'), 'utf8');
const favicon = await readFile(path.join(repoRoot, 'tests/course/fixtures/favicon.svg'));
const checks = {
  inputs: { page: pagePath, viewport: '1280x800', deviceScaleFactor: 1, fontFixture: 'tests/course/fixtures/deterministic.css', iconFixture: 'tests/course/fixtures/favicon.svg', unsupportedFeature: 'Element.prototype.getBoundingClientRect unavailable' },
  expected: { anchorCount: 19, baselineHighlightCount: 0, supportedHighlightCount: 1, unsupportedFallbackCount: 1, fallbackText: 'Link highlighting is unavailable in this browser. The links remain usable.', enabledLinks: true, contextsWithIdenticalSupportedOutput: 2, pageErrors: [], consoleErrors: [] },
  baseline: {}, actual: {}, tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(repoRoot, 'node_modules/playwright/package.json'), 'utf8')).version }
};
let server;
let browser;
const contexts = [];
const pages = [];

function watchErrors(page) {
  const errors = { page: [], console: [] };
  page.on('pageerror', error => errors.page.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  return errors;
}

async function installFaviconFixture(page, requestCount) {
  await page.route('**/fixture.svg', async route => {
    requestCount.value += 1;
    await route.continue();
  });
}

async function applyFontFixture(page) {
  await page.addStyleTag({ content: fontCss });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = '/fixture.svg';
  }));
}

async function waitForHighlight(page, selector) {
  await page.waitForFunction(targetSelector => {
    const target = document.querySelector(targetSelector);
    const highlight = document.querySelector('.highlight');
    if (!target || !highlight) return false;
    const linkRect = target.getBoundingClientRect();
    const highlightRect = highlight.getBoundingClientRect();
    return Math.abs(linkRect.x - highlightRect.x) < 1 &&
      Math.abs(linkRect.y - highlightRect.y) < 1 &&
      Math.abs(linkRect.width - highlightRect.width) < 1 &&
      Math.abs(linkRect.height - highlightRect.height) < 1;
  }, selector);
}

async function createContext({ unsupportedGeometry = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  contexts.push(context);
  if (unsupportedGeometry) {
    await context.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'getBoundingClientRect', { configurable: true, value: undefined });
    });
  }
  const page = await context.newPage();
  pages.push(page);
  return page;
}

try {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/fixture.svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); response.end(favicon); return;
    }
    if (pathname === '/baseline.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(baselineHtml); return;
    }
    if (pathname === '/baseline-style.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(baselineCss); return;
    }
    if (pathname === '/index-START.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(currentHtml); return;
    }
    if (pathname === '/style.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(currentCss); return;
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

  const baselineContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  contexts.push(baselineContext);
  const baselinePage = await baselineContext.newPage();
  pages.push(baselinePage);
  const baselineErrors = watchErrors(baselinePage);
  const baselineFaviconRequests = { value: 0 };
  await installFaviconFixture(baselinePage, baselineFaviconRequests);
  const baselineResponse = await baselinePage.goto(`${baseURL}/baseline.html`, { waitUntil: 'load' });
  assert.equal(baselineResponse.status(), 200, 'baseline is served locally');
  await applyFontFixture(baselinePage);
  const baselineLink = baselinePage.locator('nav a').first();
  await baselineLink.hover();
  checks.baseline = await baselinePage.evaluate(() => ({
    anchorCount: document.querySelectorAll('a').length,
    highlightCount: document.querySelectorAll('.highlight').length,
    fallbackCount: document.querySelectorAll('.highlight-fallback').length,
    linkBox: (() => { const { x, y, width, height } = document.querySelector('nav a').getBoundingClientRect(); return { x, y, width, height }; })(),
    fontFamily: getComputedStyle(document.body).fontFamily,
    viewport: { width: innerWidth, height: innerHeight },
    pageText: document.body.innerText
  }));
  checks.baseline.faviconRequests = baselineFaviconRequests.value;
  checks.baseline.pageErrors = baselineErrors.page;
  checks.baseline.consoleErrors = baselineErrors.console;
  assert.equal(checks.baseline.anchorCount, checks.expected.anchorCount, 'baseline exposes the lesson links');
  assert.equal(checks.baseline.highlightCount, checks.expected.baselineHighlightCount, 'baseline has no hover highlight');
  assert.equal(checks.baseline.fallbackCount, 0, 'baseline has no feature fallback');
  assert.equal(checks.baseline.faviconRequests, 1, 'baseline external icon uses the local fixture');
  assert.deepEqual(baselineErrors.page, [], 'baseline has no uncaught errors');
  assert.deepEqual(baselineErrors.console, [], 'baseline has no console errors');

  async function runSupportedContext() {
    const page = await createContext();
    const errors = watchErrors(page);
    const faviconRequests = { value: 0 };
    await installFaviconFixture(page, faviconRequests);
    const response = await page.goto(`${baseURL}/index-START.html`, { waitUntil: 'load' });
    assert.equal(response.status(), 200, 'changed page is served locally');
    await applyFontFixture(page);

    const topLink = page.locator('nav a').first();
    await topLink.evaluate(element => element.setAttribute('data-regression-target', 'top'));
    await topLink.hover();
    await waitForHighlight(page, '[data-regression-target="top"]');
    const topLayout = await page.evaluate(() => {
      const target = document.querySelector('[data-regression-target="top"]');
      const highlight = document.querySelector('.highlight');
      const link = target.getBoundingClientRect();
      const box = highlight.getBoundingClientRect();
      return {
        link: { x: Math.round(link.x), y: Math.round(link.y), width: Math.round(link.width), height: Math.round(link.height) },
        highlight: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        inlineWidth: highlight.style.width,
        inlineHeight: highlight.style.height,
        transform: highlight.style.transform.match(/[\d.]+/g).map(value => Math.round(Number(value))),
        ariaHidden: highlight.getAttribute('aria-hidden'),
        position: getComputedStyle(highlight).position
      };
    });

    const contentLink = page.locator('.wrapper a').last();
    await contentLink.evaluate(element => element.setAttribute('data-regression-target', 'scrolled'));
    await contentLink.scrollIntoViewIfNeeded();
    await contentLink.hover();
    await waitForHighlight(page, '[data-regression-target="scrolled"]');
    const scrolledLayout = await page.evaluate(() => {
      const target = document.querySelector('[data-regression-target="scrolled"]');
      const highlight = document.querySelector('.highlight');
      const link = target.getBoundingClientRect();
      const box = highlight.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        link: { x: Math.round(link.x), y: Math.round(link.y), width: Math.round(link.width), height: Math.round(link.height) },
        highlight: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        transform: highlight.style.transform.match(/[\d.]+/g).map(value => Math.round(Number(value)))
      };
    });
    const snapshot = await page.evaluate(() => ({
      anchorCount: document.querySelectorAll('a').length,
      highlightCount: document.querySelectorAll('.highlight').length,
      fallbackCount: document.querySelectorAll('.highlight-fallback').length,
      visibleText: document.body.innerText,
      viewport: { width: innerWidth, height: innerHeight },
      fontFamily: getComputedStyle(document.body).fontFamily
    }));
    assert.equal(faviconRequests.value, 1, 'changed page external icon uses the local fixture');
    assert.deepEqual(errors.page, [], 'supported page has no uncaught errors');
    assert.deepEqual(errors.console, [], 'supported page has no console errors');
    return { snapshot, topLayout, scrolledLayout, pageErrors: errors.page, consoleErrors: errors.console };
  }

  const supportedOne = await runSupportedContext();
  const supportedTwo = await runSupportedContext();
  checks.actual.supportedContexts = [supportedOne, supportedTwo];
  assert.deepEqual(supportedOne, supportedTwo, 'supported behavior is deterministic across two fresh contexts');
  assert.equal(supportedOne.snapshot.anchorCount, checks.expected.anchorCount, 'supported page preserves all links');
  assert.equal(supportedOne.snapshot.highlightCount, checks.expected.supportedHighlightCount, 'supported page creates one highlight');
  assert.equal(supportedOne.snapshot.fallbackCount, 0, 'supported page does not show fallback text');
  assert.equal(supportedOne.topLayout.ariaHidden, 'true', 'decorative highlight is hidden from assistive technology');
  assert.equal(supportedOne.topLayout.position, 'absolute', 'highlight uses the positioned overlay layout');
  assert.deepEqual(supportedOne.topLayout.highlight, supportedOne.topLayout.link, 'hovered nav link and highlight geometry match');
  assert.ok(supportedOne.scrolledLayout.scrollY > 0, 'content-link check exercises the scrolled path');
  assert.deepEqual(supportedOne.scrolledLayout.highlight, supportedOne.scrolledLayout.link, 'scrolled link and highlight geometry match');

  const unsupportedPage = await createContext({ unsupportedGeometry: true });
  const unsupportedErrors = watchErrors(unsupportedPage);
  const unsupportedFaviconRequests = { value: 0 };
  await installFaviconFixture(unsupportedPage, unsupportedFaviconRequests);
  const unsupportedResponse = await unsupportedPage.goto(`${baseURL}/index-START.html`, { waitUntil: 'load' });
  assert.equal(unsupportedResponse.status(), 200);
  await applyFontFixture(unsupportedPage);
  const fallback = unsupportedPage.getByRole('status');
  await fallback.waitFor();
  checks.actual.unsupported = await unsupportedPage.evaluate(() => ({
    geometryApiAvailable: typeof Element.prototype.getBoundingClientRect === 'function',
    highlightCount: document.querySelectorAll('.highlight').length,
    fallbackCount: document.querySelectorAll('.highlight-fallback').length,
    fallbackText: document.querySelector('[role="status"]')?.textContent,
    anchorCount: document.querySelectorAll('a').length,
    linksRemainEnabled: [...document.querySelectorAll('a')].every(link => !link.hasAttribute('aria-disabled') && !link.hasAttribute('disabled')),
    fallbackDisplay: getComputedStyle(document.querySelector('.highlight-fallback')).display,
    fallbackLineHeight: getComputedStyle(document.querySelector('.highlight-fallback')).lineHeight
  }));
  checks.actual.unsupported.faviconRequests = unsupportedFaviconRequests.value;
  checks.actual.unsupported.pageErrors = unsupportedErrors.page;
  checks.actual.unsupported.consoleErrors = unsupportedErrors.console;
  assert.equal(checks.actual.unsupported.geometryApiAvailable, false, 'unsupported path stubs the missing geometry API');
  assert.equal(checks.actual.unsupported.highlightCount, 0, 'unsupported path does not pretend a highlight was positioned');
  assert.equal(checks.actual.unsupported.fallbackCount, checks.expected.unsupportedFallbackCount, 'unsupported path shows one fallback');
  assert.equal(checks.actual.unsupported.fallbackText, checks.expected.fallbackText, 'fallback clearly explains the unsupported behavior');
  assert.equal(checks.actual.unsupported.anchorCount, checks.expected.anchorCount, 'fallback preserves lesson links');
  assert.equal(checks.actual.unsupported.linksRemainEnabled, checks.expected.enabledLinks, 'links remain usable without the highlight API');
  assert.notEqual(checks.actual.unsupported.fallbackDisplay, 'none', 'fallback is rendered');
  assert.notEqual(checks.actual.unsupported.fallbackLineHeight, 'normal', 'fallback text has readable line spacing');
  assert.equal(unsupportedFaviconRequests.value, 1, 'unsupported page external icon uses the local fixture');
  assert.deepEqual(unsupportedErrors.page, [], 'unsupported path has no uncaught errors');
  assert.deepEqual(unsupportedErrors.console, [], 'unsupported path has no console errors');

  const workDir = path.join(repoRoot, 'work/R57-T046');
  await mkdir(workDir, { recursive: true });
  await pages.at(-2).screenshot({ path: path.join(workDir, 'supported.png'), fullPage: true });
  await unsupportedPage.screenshot({ path: path.join(workDir, 'unsupported.png'), fullPage: true });
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  checks.error = error?.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {};
  for (let i = 0; i < contexts.length; i++) await contexts[i].close();
  cleanup.contextsClosed = contexts.every(context => context.pages().every(page => page.isClosed()));
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  checks.cleanup = cleanup;
  const workDir = path.join(repoRoot, 'work/R57-T046');
  await mkdir(workDir, { recursive: true });
  await writeFile(path.join(workDir, 'results.json'), `${JSON.stringify(checks, null, 2)}\n`);
}
