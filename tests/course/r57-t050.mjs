import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = '23 - Speech Synthesis';
const startPath = `${folder}/index-START.html`;
const finishedPath = `${folder}/index-FINISHED.html`;
const readFromHead = file => execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
const localize = html => html
  .replace(/<link href=['"]https:\/\/fonts\.googleapis\.com[^>]+>\s*/i, '')
  .replace(/https:\/\/fav\.farm\/[^"']+/, '/fixtures/favicon.svg');
const baselineStart = localize(readFromHead(startPath));
const finished = localize(readFromHead(finishedPath));
const mutated = finished.replace("speakButton.addEventListener('click', toggle);", "speakButton.addEventListener('click', () => {});");
assert.notEqual(mutated, finished, 'mutation fixture changes exactly the Speak event binding');
const style = await readFile(path.join(root, folder, 'style.css'), 'utf8');
const fixtureCss = await readFile(path.join(root, 'tests/course/fixtures/deterministic.css'), 'utf8');
const favicon = await readFile(path.join(root, 'tests/course/fixtures/favicon.svg'));
const evidenceDir = path.join(root, 'work/R57-T050');
await mkdir(evidenceDir, { recursive: true });
const stubScript = `
  (() => {
    const voices = [
      { name: 'Amy English', lang: 'en-US', voiceURI: 'amy' },
      { name: 'Brian English', lang: 'en-GB', voiceURI: 'brian' },
      { name: 'Claire French', lang: 'fr-FR', voiceURI: 'claire' }
    ];
    class TestUtterance {
      constructor() { this.text = ''; this.rate = 1; this.pitch = 1; this.voice = null; }
    }
    const state = { voices, spoken: [], cancelCount: 0 };
    class TestSpeechSynthesis extends EventTarget {
      getVoices() { return voices; }
      speak(utterance) { state.spoken.push({ text: utterance.text, rate: utterance.rate, pitch: utterance.pitch, voice: utterance.voice?.name ?? null }); }
      cancel() { state.cancelCount += 1; }
    }
    const api = new TestSpeechSynthesis();
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: TestUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: api });
    window.__speechFixture = state;
    window.__dispatchVoicesChanged = () => api.dispatchEvent(new Event('voiceschanged'));
  })();
`;
const results = {
  inputs: {
    sourcePage: startPath,
    completedReference: finishedPath,
    viewport: '1280x900',
    deterministicVoices: ['Amy English (en-US)', 'Brian English (en-GB)', 'Claire French (fr-FR)'],
    stubbedNativeFeature: 'SpeechSynthesisUtterance and speechSynthesis',
    mutation: "speakButton.addEventListener('click', toggle) replaced by a no-op listener in the temporary served fixture"
  },
  expected: {
    englishVoices: ['Amy English', 'Brian English'],
    defaultText: 'Hello! I love JavaScript 👍',
    speakButtonAddsUtterance: 1,
    stopButtonAddsNoUtterance: true,
    stopCallsCancel: true,
    brokenSpeakBindingRejected: true,
    pageErrors: [],
    consoleErrors: []
  },
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

async function makePage(origin, route, { mutation = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  contexts.push(context);
  await context.addInitScript(stubScript);
  const page = await context.newPage();
  watch(page);
  const response = await page.goto(`${origin}/${route}`, { waitUntil: 'load' });
  assert.equal(response.status(), 200, `${route} loads from the local server`);
  await page.addStyleTag({ content: fixtureCss });
  if (!route.includes('baseline')) await page.evaluate(() => window.__dispatchVoicesChanged());
  return { page, mutation };
}

function snapshotScript() {
  return {
    title: document.title,
    heading: document.querySelector('h1')?.textContent,
    voiceOptions: [...document.querySelector('#voices').options].map(option => ({ value: option.value, text: option.textContent })),
    defaultText: document.querySelector('[name="text"]').value,
    controlValues: {
      rate: document.querySelector('[name="rate"]').value,
      pitch: document.querySelector('[name="pitch"]').value
    },
    layout: (() => {
      const panel = document.querySelector('.voiceinator').getBoundingClientRect();
      const speak = document.querySelector('#speak').getBoundingClientRect();
      const stop = document.querySelector('#stop').getBoundingClientRect();
      return { panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height }, speak: { x: speak.x, y: speak.y, width: speak.width, height: speak.height }, stop: { x: stop.x, y: stop.y, width: stop.width, height: stop.height } };
    })(),
    fontFamily: getComputedStyle(document.querySelector('h1')).fontFamily
  };
}

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const pages = {
      '/baseline.html': baselineStart,
      '/index-START.html': baselineStart,
      '/index-FINISHED.html': finished,
      '/mutated.html': mutated
    };
    if (pathname in pages) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(pages[pathname]);
    } else if (pathname === '/style.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(style);
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

  const { page: baselinePage } = await makePage(origin, 'baseline.html');
  results.baseline.starter = await baselinePage.evaluate(snapshotScript);
  assert.equal(results.baseline.starter.heading, 'The Voiceinator 5000', 'starter retains the lesson heading');
  assert.equal(results.baseline.starter.voiceOptions.length, 1, 'starter has only the placeholder voice option');
  assert.equal(results.baseline.starter.defaultText, results.expected.defaultText, 'starter shows the default utterance text');
  assert.equal(results.baseline.starter.layout.panel.width, 500, 'starter panel uses the intended 50rem width');
  assert.equal((await baselinePage.locator('#speak').count()), 1, 'starter exposes the Speak control');
  assert.equal((await baselinePage.locator('#stop').count()), 1, 'starter exposes the Stop control');
  await baselinePage.screenshot({ path: path.join(evidenceDir, 'baseline-starter.png'), fullPage: true });

  const { page } = await makePage(origin, 'index-FINISHED.html');
  results.baseline.finishedInitial = await page.evaluate(snapshotScript);
  assert.deepEqual(results.baseline.finishedInitial.voiceOptions.map(option => option.value), ['Amy English', 'Brian English'], 'voice list contains only supported English fixtures');
  const voice = page.locator('#voices');
  await voice.selectOption('Amy English');
  results.actual.afterVoiceSelection = await page.evaluate(() => ({ selectedVoice: window.__speechFixture.spoken.at(-1)?.voice, spokenCount: window.__speechFixture.spoken.length, cancelCount: window.__speechFixture.cancelCount }));
  assert.equal(results.actual.afterVoiceSelection.selectedVoice, 'Amy English', 'voice selection speaks using the selected fixture voice');
  assert.equal(results.actual.afterVoiceSelection.spokenCount, 1, 'selecting a voice queues one utterance');

  await page.locator('#speak').click();
  results.actual.afterSpeak = await page.evaluate(() => ({ spokenCount: window.__speechFixture.spoken.length, lastUtterance: window.__speechFixture.spoken.at(-1) }));
  assert.equal(results.actual.afterSpeak.spokenCount, results.expected.speakButtonAddsUtterance + 1, 'Speak button adds exactly one utterance after voice selection');
  assert.equal(results.actual.afterSpeak.lastUtterance.voice, 'Amy English', 'Speak uses the selected voice');

  await page.locator('#stop').click();
  results.actual.afterStop = await page.evaluate(() => ({ spokenCount: window.__speechFixture.spoken.length, cancelCount: window.__speechFixture.cancelCount }));
  assert.equal(results.actual.afterStop.spokenCount, results.actual.afterSpeak.spokenCount, 'Stop does not queue an utterance');
  assert.equal(results.actual.afterStop.cancelCount, results.actual.afterSpeak.spokenCount + 1, 'Stop cancels current speech');

  const mutationContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
  contexts.push(mutationContext);
  await mutationContext.addInitScript(stubScript);
  const mutationPage = await mutationContext.newPage();
  watch(mutationPage);
  const mutationResponse = await mutationPage.goto(`${origin}/mutated.html`, { waitUntil: 'load' });
  assert.equal(mutationResponse.status(), 200, 'mutated fixture loads from the local server');
  await mutationPage.evaluate(() => window.__dispatchVoicesChanged());
  await mutationPage.locator('#speak').click();
  const mutationActual = await mutationPage.evaluate(() => window.__speechFixture.spoken.length);
  results.actual.mutatedSpeakCount = mutationActual;
  let rejectedForMissingSpeakEffect = false;
  try {
    assert.equal(mutationActual, results.expected.speakButtonAddsUtterance, 'Speak button adds one utterance (the deliberate no-op binding must be rejected)');
  } catch (error) {
    if (!(error instanceof assert.AssertionError) || !error.message.includes('deliberate no-op binding')) throw error;
    rejectedForMissingSpeakEffect = true;
    results.actual.mutationFailure = { name: error.name, message: error.message, expected: error.expected, actual: error.actual };
  }
  assert.equal(rejectedForMissingSpeakEffect, results.expected.brokenSpeakBindingRejected, 'behavioral assertion rejects the broken event binding');
  assert.equal(mutationActual, 0, 'broken fixture fails because the Speak click queues no utterance');

  await page.screenshot({ path: path.join(evidenceDir, 'finished-controls-after-interaction.png'), fullPage: true });
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
