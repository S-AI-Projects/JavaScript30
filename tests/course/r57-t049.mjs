import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = '15 - LocalStorage';
const pagePath = `${folder}/index-START.html`;
const baselineHtml = execFileSync('git', ['show', `HEAD:${pagePath}`], { cwd: root, encoding: 'utf8' })
  .replace('href="style.css"', 'href="baseline-style.css"')
  .replace('https://fav.farm/🔥', '/fixtures/favicon.svg');
const currentHtml = (await readFile(path.join(root, pagePath), 'utf8')).replace('https://fav.farm/🔥', '/fixtures/favicon.svg');
const baselineCss = execFileSync('git', ['show', `HEAD:${folder}/style.css`], { cwd: root, encoding: 'utf8' });
const currentCss = await readFile(path.join(root, folder, 'style.css'), 'utf8');
const image = await readFile(path.join(root, folder, 'oh-la-la.jpeg'));
const favicon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#193549"/></svg>');
const fontCss = await readFile(path.join(root, 'tests/course/fixtures/deterministic.css'), 'utf8');
const evidenceDir = path.join(root, 'work/R57-T049');
await mkdir(evidenceDir, { recursive: true });
const viewports = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'narrow', width: 320, height: 700 }];
const results = {
  inputs: { page: pagePath, reducedMotion: 'reduce', viewports, keyboardSequence: ['Tab: item text field', 'Tab: submit button'], backgroundFixture: `${folder}/oh-la-la.jpeg`, faviconFixture: 'tests/course/fixtures/favicon.svg', fontFixture: 'tests/course/fixtures/deterministic.css' },
  expected: { textFieldFocusable: true, submitFocusable: true, changedFocusOutline: '3px solid rgb(25, 53, 73)', changedFocusRing: 'rgb(255, 198, 0)', noMotion: true, horizontalOverflow: false, pageErrors: [], consoleErrors: [] },
  baseline: {},
  actual: {},
  tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(root, 'node_modules/playwright/package.json'), 'utf8')).version }
};
let server;
let browser;
const contexts = [];
const errors = { page: [], console: [] };

function watch(page) {
  page.on('pageerror', error => errors.page.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
}

function servedStyle(css) {
  return css.replace(/url\(["']?oh-la-la\.jpeg["']?\)/g, 'url("/oh-la-la.jpeg")');
}

async function runPage({ origin, viewport, baseline, screenshot }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce'
  });
  contexts.push(context);
  const page = await context.newPage();
  watch(page);
  const response = await page.goto(`${origin}/${baseline ? 'baseline.html' : 'index-START.html'}`, { waitUntil: 'load' });
  assert.equal(response.status(), 200, 'page loads from the local server');
  await page.addStyleTag({ content: fontCss });
  const field = page.locator('.add-items input[type="text"]');
  const submit = page.locator('.add-items input[type="submit"]');
  assert.equal(await field.isVisible(), true, 'item field is visible');
  assert.equal(await field.isEnabled(), true, 'item field is enabled');
  assert.equal(await submit.isVisible(), true, 'submit control is visible');
  assert.equal(await submit.isEnabled(), true, 'submit control is enabled');
  await page.keyboard.press('Tab');
  assert.equal(await field.evaluate(element => element === document.activeElement), true, 'first Tab focuses the item field');
  const fieldFocus = await field.evaluate(element => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
    outlineColor: getComputedStyle(element).outlineColor,
    outlineOffset: getComputedStyle(element).outlineOffset,
    boxShadow: getComputedStyle(element).boxShadow,
    bounds: (() => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; })()
  }));
  await page.keyboard.press('Tab');
  assert.equal(await submit.evaluate(element => element === document.activeElement), true, 'second Tab focuses the submit control');
  const submitFocus = await submit.evaluate(element => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
    outlineColor: getComputedStyle(element).outlineColor,
    outlineOffset: getComputedStyle(element).outlineOffset,
    boxShadow: getComputedStyle(element).boxShadow,
    bounds: (() => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; })()
  }));
  const motion = await page.evaluate(() => ({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animatedElements: [...document.querySelectorAll('html, body, .wrapper, .add-items, .add-items input')]
      .filter(element => getComputedStyle(element).animationName !== 'none' || getComputedStyle(element).transitionDuration !== '0s')
      .length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    wrapper: (() => { const rect = document.querySelector('.wrapper').getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; })()
  }));
  if (screenshot) await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: true });
  return { viewport: viewport.name, fieldFocus, submitFocus, motion };
}

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const pages = { '/baseline.html': baselineHtml, '/index-START.html': currentHtml };
    const styles = { '/baseline-style.css': baselineCss, '/style.css': currentCss };
    if (pathname in pages) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(pages[pathname]);
    } else if (pathname in styles) {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(servedStyle(styles[pathname]));
    } else if (pathname === '/oh-la-la.jpeg') {
      response.writeHead(200, { 'content-type': 'image/jpeg' }); response.end(image);
    } else if (pathname === '/fixtures/favicon.svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); response.end(favicon);
    } else {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  results.tools.chromium = browser.version();

  for (const viewport of viewports) {
    const baseline = await runPage({ origin, viewport, baseline: true, screenshot: viewport.name === 'desktop' ? 'baseline.png' : undefined });
    results.baseline[viewport.name] = baseline;
    assert.equal(baseline.motion.reducedMotion, true, `${viewport.name} baseline recognizes reduced motion`);
    assert.equal(baseline.motion.animatedElements, 0, `${viewport.name} baseline contains no animation or transition`);
    assert.equal(baseline.motion.horizontalOverflow, results.expected.horizontalOverflow, `${viewport.name} baseline fits viewport width`);
    assert.equal(baseline.fieldFocus.outlineWidth, '0px', `${viewport.name} baseline focus outline is removed`);

    const changed = await runPage({ origin, viewport, baseline: false, screenshot: `${viewport.name}-reduced-motion-focus.png` });
    results.actual[viewport.name] = changed;
    assert.equal(changed.motion.reducedMotion, true, `${viewport.name} changed page recognizes reduced motion`);
    assert.equal(changed.motion.animatedElements, 0, `${viewport.name} changed page remains static under reduced motion`);
    assert.equal(changed.motion.horizontalOverflow, results.expected.horizontalOverflow, `${viewport.name} changed page fits viewport width`);
    for (const controlFocus of [changed.fieldFocus, changed.submitFocus]) {
      assert.equal(controlFocus.outlineStyle, 'solid', `${viewport.name} keyboard focus has a visible outline`);
      assert.equal(controlFocus.outlineWidth, '3px', `${viewport.name} keyboard focus outline has 3px width`);
      assert.equal(controlFocus.outlineColor, 'rgb(25, 53, 73)', `${viewport.name} keyboard focus outline has contrast color`);
      assert.equal(controlFocus.outlineOffset, '3px', `${viewport.name} keyboard focus outline is offset`);
      assert.ok(controlFocus.boxShadow.includes('rgb(255, 198, 0)'), `${viewport.name} keyboard focus has the yellow outer ring`);
      assert.ok(controlFocus.bounds.left >= 0 && controlFocus.bounds.right <= viewport.width, `${viewport.name} focused control stays inside viewport`);
    }
  }
  assert.deepEqual(errors.page, [], 'no uncaught page errors');
  assert.deepEqual(errors.console, [], 'no browser console errors');
  results.actual.errors = errors;
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.error = error?.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {};
  for (const context of contexts) await context.close();
  cleanup.contextsClosed = contexts.every(context => context.pages().every(page => page.isClosed()));
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  results.cleanup = cleanup;
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
}
