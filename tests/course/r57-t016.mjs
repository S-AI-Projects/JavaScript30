import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8770;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/27%20-%20Click%20and%20Drag/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T016');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

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
    // 1. FEATURE-PRESENT PATH (Drag Supported)
    // ==========================================
    const context1 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await context1.route('**unsplash**', (route) => route.fulfill({ status: 200, body: '' }));
    await context1.route('**fav.farm**', (route) => route.fulfill({ status: 200, body: '' }));

    const page1 = await context1.newPage();
    const errors1 = [];
    page1.on('pageerror', (err) => errors1.push(err.message));

    const response = await page1.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Feature-Present: Page loads with HTTP 200', 200, response.status(), response.status() === 200);

    const initialScroll = await page1.$eval('.items', (el) => el.scrollLeft);
    record('Feature-Present: Initial scrollLeft is 0', 0, initialScroll, initialScroll === 0);

    const bannerHidden = await page1.$eval('#fallback-banner', (el) => !el.classList.contains('visible'));
    record('Feature-Present: Fallback banner is hidden', true, bannerHidden, bannerHidden === true);

    // Perform mouse drag: mousedown at center of .items, drag left by 200px
    const sliderBox = await page1.$eval('.items', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    await page1.mouse.move(sliderBox.x, sliderBox.y);
    await page1.mouse.down();
    const isDragActive = await page1.$eval('.items', (el) => el.classList.contains('active'));
    record('Feature-Present: Mousedown adds .active class', true, isDragActive, isDragActive === true);

    await page1.mouse.move(sliderBox.x - 200, sliderBox.y, { steps: 10 });
    const draggedScroll = await page1.$eval('.items', (el) => el.scrollLeft);
    record('Feature-Present: Dragging mouse updates scrollLeft (> 0)', true, draggedScroll > 0, draggedScroll > 0);

    await page1.mouse.up();
    const isActiveRemoved = await page1.$eval('.items', (el) => !el.classList.contains('active'));
    record('Feature-Present: Mouseup removes .active class', true, isActiveRemoved, isActiveRemoved === true);

    const screenshot1Path = path.join(WORK_DIR, 'screenshot-drag-supported.png');
    await page1.screenshot({ path: screenshot1Path });
    console.log(`Saved supported drag screenshot: ${screenshot1Path}`);

    await context1.close();

    // ==========================================
    // 2. FEATURE-ABSENT PATH (Drag Unsupported)
    // ==========================================
    const context2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await context2.route('**unsplash**', (route) => route.fulfill({ status: 200, body: '' }));
    await context2.route('**fav.farm**', (route) => route.fulfill({ status: 200, body: '' }));

    const page2 = await context2.newPage();
    const errors2 = [];
    page2.on('pageerror', (err) => errors2.push(err.message));

    // Stub drag interaction as unsupported prior to page script load
    await page2.addInitScript(() => {
      window.__FORCE_DRAG_UNSUPPORTED__ = true;
    });

    await page2.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });

    // Fallback banner should now be visible
    const isBannerVisible = await page2.$eval('#fallback-banner', (el) => el.classList.contains('visible'));
    record('Feature-Absent: Fallback notification banner is visible', true, isBannerVisible, isBannerVisible === true);

    const bannerText = await page2.$eval('#fallback-banner', (el) => el.textContent.trim());
    record('Feature-Absent: Banner contains helpful fallback guidance', true, bannerText.includes('arrow buttons'), bannerText.includes('arrow buttons'));

    // Test accessible fallback navigation controls
    const scrollBeforeBtn = await page2.$eval('.items', (el) => el.scrollLeft);
    await page2.click('.next-btn');
    const scrollAfterNext = await page2.$eval('.items', (el) => el.scrollLeft);
    record('Feature-Absent: Next button scrolls items forward', true, scrollAfterNext > scrollBeforeBtn, scrollAfterNext > scrollBeforeBtn);

    await page2.click('.prev-btn');
    const scrollAfterPrev = await page2.$eval('.items', (el) => el.scrollLeft);
    record('Feature-Absent: Previous button scrolls items backward', true, scrollAfterPrev < scrollAfterNext, scrollAfterPrev < scrollAfterNext);

    const screenshot2Path = path.join(WORK_DIR, 'screenshot-drag-fallback.png');
    await page2.screenshot({ path: screenshot2Path });
    console.log(`Saved fallback screenshot: ${screenshot2Path}`);

    await context2.close();

    // Error checks
    record('No unhandled page errors across paths', 0, errors1.length + errors2.length, errors1.length + errors2.length === 0);

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
      task: 'R57-T016',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      paths_tested: ['Feature-Present (Mouse click-and-drag active)', 'Feature-Absent (Drag unsupported with accessible controls)'],
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
