import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = '28 - Video Speed Controller';
const startPath = `${folder}/index-START.html`;
const companionPath = `${folder}/text-rendering.html`;
const baselineSource = execFileSync('git', ['show', `HEAD:${startPath}`], { cwd: root, encoding: 'utf8' });
const companion = await readFile(path.join(root, companionPath), 'utf8');
const style = (await readFile(path.join(root, folder, 'style.css'), 'utf8'))
  .replace("url('https://unsplash.it/1500/900?image=1021')", "url('/fixtures/video-controller-background.svg')");
const fixtureImage = await readFile(path.join(root, 'tests/course/fixtures/video-controller-background.svg'));
const fontCss = await readFile(path.join(root, 'tests/course/fixtures/deterministic.css'), 'utf8');
const maliciousText = 'Lesson note: [image](https://github.com/S-AI-Projects/JavaScript30/issues/x) <img src="missing-image" onerror="window.__injected = true">';
const evidenceDir = path.join(root, 'work/R57-T048');
await mkdir(evidenceDir, { recursive: true });
const results = {
  inputs: { sourcePage: startPath, companionPage: companionPath, viewport: '1280x720', deviceScaleFactor: 1, text: maliciousText, backgroundFixture: 'tests/course/fixtures/video-controller-background.svg', fontFixture: 'tests/course/fixtures/deterministic.css' },
  expected: { sourceHasVideo: true, sourceHasTextInput: false, previewText: maliciousText, injectedElementCount: 0, injectedHandlerValue: false, richHtmlContract: 'none; preview is plain text', pageErrors: [], consoleErrors: [] },
  baseline: {},
  actual: {},
  tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(root, 'node_modules/playwright/package.json'), 'utf8')).version }
};
let server;
let browser;
let context;
let page;
const errors = { page: [], console: [] };

function watch(pageToWatch) {
  pageToWatch.on('pageerror', error => errors.page.push(error.message));
  pageToWatch.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
}

function localizeSource(html) {
  return html
    .replace('http://clips.vorwaerts-gmbh.de/VfE_html5.mp4', '')
    .replace('https://fav.farm/🔥', '/fixtures/video-controller-background.svg');
}

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/index-START.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(localizeSource(baselineSource));
    } else if (pathname === '/text-rendering.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(companion);
    } else if (pathname === '/style.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(style);
    } else if (pathname === '/fixtures/video-controller-background.svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); response.end(fixtureImage);
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
  context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  page = await context.newPage();
  watch(page);

  const sourceResponse = await page.goto(`${origin}/index-START.html`, { waitUntil: 'load' });
  assert.equal(sourceResponse.status(), 200, 'real lesson starter page loads from the local server');
  await page.addStyleTag({ content: fontCss });
  const video = page.locator('video.flex');
  await video.waitFor({ state: 'visible' });
  results.baseline.videoLesson = await page.evaluate(() => {
    const video = document.querySelector('video.flex');
    const speedTrack = document.querySelector('.speed');
    const speedBar = document.querySelector('.speed-bar');
    const box = element => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; };
    return {
      title: document.title,
      videoPresent: Boolean(video),
      videoControls: video.controls,
      videoDimensions: box(video),
      speedTrack: box(speedTrack),
      speedBarText: speedBar.textContent,
      textInputs: document.querySelectorAll('input, textarea, [contenteditable="true"]').length,
      fontFamily: getComputedStyle(document.body).fontFamily
    };
  });
  assert.equal(results.baseline.videoLesson.videoPresent, results.expected.sourceHasVideo, 'lesson contains its video element');
  assert.equal(results.baseline.videoLesson.videoControls, true, 'native controls remain enabled');
  assert.equal(results.baseline.videoLesson.textInputs, 0, 'video lesson has no text input');
  assert.equal(results.baseline.videoLesson.speedBarText, '1×', 'starter speed indicator begins at 1×');
  await page.screenshot({ path: path.join(evidenceDir, 'video-lesson-baseline.png'), fullPage: true });

  const companionResponse = await page.goto(`${origin}/text-rendering.html`, { waitUntil: 'load' });
  assert.equal(companionResponse.status(), 200, 'isolated text companion loads locally');
  await page.addStyleTag({ content: fontCss });
  await page.evaluate(() => { window.__injected = false; });
  const input = page.getByLabel('Text to display');
  await input.fill(maliciousText);
  const preview = page.getByRole('status');
  await assert.doesNotReject(() => preview.waitFor({ state: 'visible' }));
  results.actual.companion = await page.evaluate(() => {
    const preview = document.querySelector('#preview');
    const rect = preview.getBoundingClientRect();
    return {
      text: preview.textContent,
      childNodes: [...preview.childNodes].map(node => node.nodeType),
      injectedElements: preview.querySelectorAll('*').length,
      relatedElements: document.querySelectorAll('#preview img, #preview a, #preview svg').length,
      handlerExecuted: window.__injected,
      computedDisplay: getComputedStyle(preview).display,
      box: { width: rect.width, height: rect.height },
      outputFont: getComputedStyle(preview).fontFamily
    };
  });
  assert.equal(results.actual.companion.text, maliciousText, 'the complete user string appears literally');
  assert.deepEqual(results.actual.companion.childNodes, [3], 'preview contains only its text node');
  assert.equal(results.actual.companion.injectedElements, results.expected.injectedElementCount, 'text creates no elements');
  assert.equal(results.actual.companion.relatedElements, 0, 'markdown image syntax creates neither image nor link');
  assert.equal(results.actual.companion.handlerExecuted, results.expected.injectedHandlerValue, 'markup handler does not run');
  assert.equal(results.actual.companion.computedDisplay, 'block', 'preview is visibly rendered');
  assert.ok(results.actual.companion.box.width > 0 && results.actual.companion.box.height > 0, 'preview has visible layout dimensions');
  await page.screenshot({ path: path.join(evidenceDir, 'text-preview-literal.png'), fullPage: true });
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
  if (context) await context.close();
  cleanup.contextClosed = !context || context.pages().every(openPage => openPage.isClosed());
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  results.cleanup = cleanup;
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
}
