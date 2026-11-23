import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'work/R57-T024';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error);
  });

  await page.setContent(`
    <style>
      #one { padding: 20px; }
      #two { padding: 20px; }
      #three { padding: 20px; }
    </style>

    <div id="one">
      <div id="two">
        <div id="three"></div>
      </div>
    </div>

    <div id="log"></div>

    <script>
      const divs = document.querySelectorAll('#one, #two, #three');

      function logText() {
        document.querySelector('#log').textContent += this.id + ',';
      }

      divs.forEach(div => {
        div.addEventListener('click', logText, {
          capture: false,
          once: true
        });
      });
    </script>
  `);

  await page.screenshot({
    path: `${evidenceDir}/baseline.png`,
    fullPage: true
  });

  const result = page.locator('#log');

  await page.locator('#three').click();

  const firstClick = await result.textContent();

  assert.equal(
    firstClick,
    'three,two,one,',
    'First click should trigger each bubbling handler exactly once.'
  );

  await page.locator('#three').click();

  const secondClick = await result.textContent();

  assert.equal(
    secondClick,
    'three,two,one,',
    'Second click must not trigger the once-only handlers again.'
  );

  const listenerCounts = await page.evaluate(() => ({
    divCount: document.querySelectorAll('#one, #two, #three, #log').length,
    logText: document.querySelector('#log').textContent
  }));

  assert.equal(
    listenerCounts.divCount,
    4,
    'The isolated harness should not create duplicate DOM nodes.'
  );

  assert.equal(
    listenerCounts.logText,
    'three,two,one,',
    'Repeated interaction must not duplicate event effects.'
  );

  assert.equal(
    pageErrors.length,
    0,
    'The browser must not report unexpected page errors.'
  );

  await page.screenshot({
    path: `${evidenceDir}/repeated-interaction.png`,
    fullPage: true
  });

  console.log('First click: PASS — three handlers fired once.');
  console.log('Second click: PASS — once-only handlers did not fire again.');
  console.log('DOM count: PASS — no duplicate test-created nodes.');
  console.log('Page errors: PASS — no unexpected errors.');
  console.log('R57-T024 regression checks passed.');
} finally {
  await browser.close();
}