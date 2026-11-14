import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8769;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/15%20-%20LocalStorage/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T015');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const FIXTURE_ITEMS = [
  { text: 'Fish Tacos', done: true },
  { text: 'Quesadilla', done: false }
];

function createStaticServer() {
  return http.createServer((req, res) => {
    try {
      const decodedPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(rootDir, decodedPath === '/' ? 'index.html' : decodedPath);

      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      });
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
}

async function runCheck() {
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const checks = [];
  function record(name, expected, actual, passed) {
    checks.push({ name, expected, actual, passed });
    const mark = passed ? '✓' : '✗';
    console.log(`[${mark}] ${name}`);
    if (!passed) {
      console.error(`    Expected: ${JSON.stringify(expected)}`);
      console.error(`    Actual:   ${JSON.stringify(actual)}`);
    }
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Test server running at ${BASE_URL}`);

  let browser;
  let allPassed = true;

  try {
    browser = await chromium.launch({ headless: true });

    // ==========================================
    // CONTEXT 1: Seeded with explicit local fixture
    // ==========================================
    const context1 = await browser.newContext();
    await context1.route('**fav.farm**', (route) => route.fulfill({ status: 200, body: '' }));
    const page1 = await context1.newPage();
    const errors1 = [];
    page1.on('pageerror', (err) => errors1.push(err.message));

    await page1.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    await page1.evaluate((items) => {
      localStorage.setItem('items', JSON.stringify(items));
    }, FIXTURE_ITEMS);
    const resp1 = await page1.reload({ waitUntil: 'domcontentloaded' });
    record('Context 1: Page responds with HTTP 200', 200, resp1.status(), resp1.status() === 200);

    const domState1 = await page1.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.plates li')).map((li) => {
        const input = li.querySelector('input');
        const label = li.querySelector('label');
        return {
          text: label ? label.textContent.trim() : '',
          checked: input ? input.checked : false
        };
      });
      return {
        itemCount: items.length,
        items,
        html: document.querySelector('.plates').innerHTML.trim()
      };
    });

    record('Context 1: Renders 2 fixture items', 2, domState1.itemCount, domState1.itemCount === 2);
    record('Context 1: Item 0 is checked (Fish Tacos)', true, domState1.items[0]?.checked, domState1.items[0]?.checked === true);
    record('Context 1: Item 1 is unchecked (Quesadilla)', false, domState1.items[1]?.checked, domState1.items[1]?.checked === false);

    const screenshot1Path = path.join(WORK_DIR, 'screenshot-context1.png');
    await page1.screenshot({ path: screenshot1Path });
    console.log(`Saved context 1 screenshot: ${screenshot1Path}`);

    // ==========================================
    // CONTEXT 2: Fresh browser context with same fixture
    // ==========================================
    const context2 = await browser.newContext();
    await context2.route('**fav.farm**', (route) => route.fulfill({ status: 200, body: '' }));
    const page2 = await context2.newPage();
    const errors2 = [];
    page2.on('pageerror', (err) => errors2.push(err.message));

    await page2.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    await page2.evaluate((items) => {
      localStorage.setItem('items', JSON.stringify(items));
    }, FIXTURE_ITEMS);
    const resp2 = await page2.reload({ waitUntil: 'domcontentloaded' });
    record('Context 2: Page responds with HTTP 200', 200, resp2.status(), resp2.status() === 200);

    const domState2 = await page2.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.plates li')).map((li) => {
        const input = li.querySelector('input');
        const label = li.querySelector('label');
        return {
          text: label ? label.textContent.trim() : '',
          checked: input ? input.checked : false
        };
      });
      return {
        itemCount: items.length,
        items,
        html: document.querySelector('.plates').innerHTML.trim()
      };
    });

    // Check determinism across fresh contexts
    const isDeterministic = domState1.html === domState2.html;
    record('Two fresh browser contexts produce identical asserted DOM state', true, isDeterministic, isDeterministic === true);

    const screenshot2Path = path.join(WORK_DIR, 'screenshot-context2.png');
    await page2.screenshot({ path: screenshot2Path });
    console.log(`Saved context 2 screenshot: ${screenshot2Path}`);

    // ==========================================
    // INTERACTION & PERSISTENCE TEST (Context 2)
    // ==========================================
    // Add a new item via form
    await page2.fill('.add-items input[name=item]', 'Churros');
    await page2.click('.add-items input[type=submit]');

    const itemCountAfterAdd = await page2.$$eval('.plates li', (els) => els.length);
    record('Adding item increments list count to 3', 3, itemCountAfterAdd, itemCountAfterAdd === 3);

    // Toggle Quesadilla (item 1)
    await page2.click('label[for=item1]');
    const isItem1Checked = await page2.$eval('#item1', (el) => el.checked);
    record('Clicking item label toggles checkbox state', true, isItem1Checked, isItem1Checked === true);

    // Verify localStorage was updated
    const storedItems = await page2.evaluate(() => JSON.parse(localStorage.getItem('items')));
    record('LocalStorage stores 3 items with updated state', 3, storedItems.length, storedItems.length === 3 && storedItems[1].done === true);

    // Reload page to verify persistence
    await page2.reload({ waitUntil: 'domcontentloaded' });
    const reloadedCount = await page2.$$eval('.plates li', (els) => els.length);
    record('State persists across page reload', 3, reloadedCount, reloadedCount === 3);

    record('No unhandled page errors across contexts', 0, errors1.length + errors2.length, errors1.length + errors2.length === 0);

    await context1.close();
    await context2.close();

    allPassed = checks.every((c) => c.passed);
  } catch (err) {
    console.error('Test execution failure:', err);
    record('Test execution without unhandled exception', 'Success', err.message, false);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    console.log('Server and browser cleaned up.');

    const summary = {
      task: 'R57-T015',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      checks,
      summary: {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length
      }
    };
    fs.writeFileSync(path.join(WORK_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`Saved results to ${path.join(WORK_DIR, 'results.json')}`);
  }

  if (!allPassed) {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed successfully!');
    process.exit(0);
  }
}

runCheck();
