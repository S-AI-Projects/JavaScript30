import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8765;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/17%20-%20Sort%20Without%20Articles/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T011');

// MIME types for simple static server
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
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Load target page
    const response = await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Page responds with HTTP 200', 200, response.status(), response.status() === 200);

    // 2. Validate semantic elements and landmarks
    const hasSkipLink = await page.$eval('a.skip-link', (el) => !!el).catch(() => false);
    record('Skip-to-content link exists', true, hasSkipLink, hasSkipLink === true);

    const hasBands = await page.$eval('#bands', (el) => !!el).catch(() => false);
    record('#bands container exists', true, hasBands, hasBands === true);

    // 3. Verify no positive tabindex
    const positiveTabIndexCount = await page.$$eval('[tabindex]', (els) =>
      els.filter((el) => {
        const val = parseInt(el.getAttribute('tabindex'), 10);
        return !isNaN(val) && val > 0;
      }).length
    );
    record('No positive tabindex elements exist', 0, positiveTabIndexCount, positiveTabIndexCount === 0);

    // 4. Check initial position of skip link (visually off-screen)
    const initialSkipBox = await page.$eval('.skip-link', (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        top: rect.top,
        styleTop: style.top,
        hidden: rect.bottom <= 0 || parseInt(style.top, 10) < 0
      };
    });
    record('Skip link starts positioned off-screen', true, initialSkipBox.hidden, initialSkipBox.hidden === true);

    // 5. Tab navigation to skip link
    await page.keyboard.press('Tab');
    const focusedIsSkipLink = await page.$eval(':focus', (el) => el.classList.contains('skip-link')).catch(() => false);
    record('Tab key navigates focus to skip link', true, focusedIsSkipLink, focusedIsSkipLink === true);

    // 6. Visible focus style on skip link
    const focusState = await page.$eval('.skip-link', (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        visible: rect.top >= 0 && rect.bottom > 0,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseInt(style.outlineWidth, 10) || 0
      };
    });
    record('Skip link becomes visible when focused', true, focusState.visible, focusState.visible === true);
    record('Skip link has visible outline when focused', true, focusState.outlineWidth > 0, focusState.outlineWidth > 0);

    // Take screenshot of focused skip link
    const screenshotPath = path.join(WORK_DIR, 'keyboard-focus.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

    // 7. Activate skip link with Enter
    await page.keyboard.press('Enter');
    const currentUrl = page.url();
    const hashMatched = currentUrl.endsWith('#bands');
    record('Enter key activates skip link navigating to #bands', true, hashMatched, hashMatched === true);

    // 8. Verify band items rendered inside #bands
    const bandCount = await page.$$eval('#bands li', (els) => els.length);
    record('#bands renders 13 sorted items', 13, bandCount, bandCount === 13);

    const firstBand = await page.$eval('#bands li:first-child', (el) => el.textContent.trim());
    record('First sorted band is correct (ignoring articles)', 'Anywhere But Here', firstBand, firstBand === 'Anywhere But Here');

    // 9. Check page errors
    record('No unhandled JavaScript errors', 0, pageErrors.length, pageErrors.length === 0);

    allPassed = checks.every((c) => c.passed);
  } catch (err) {
    console.error('Test execution failure:', err);
    record('Test execution without unhandled exception', 'Success', err.message, false);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    console.log('Server and browser cleaned up.');

    // Write results.json
    const summary = {
      task: 'R57-T011',
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
