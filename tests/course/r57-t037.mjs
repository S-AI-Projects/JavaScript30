import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T037');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8774) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const decoded = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(REPO_ROOT, decoded);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.mjs': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        url: `http://127.0.0.1:${port}/27%20-%20Click%20and%20Drag/index-START.html`
      });
    });
  });
}

async function runChecks() {
  const checks = [];
  function recordCheck(name, passed, expected, actual) {
    checks.push({ name, passed, expected, actual });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name} (Expected: ${expected}, Actual: ${actual})`);
  }

  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Initial page load
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Page responds with HTTP 200', response && response.status() === 200, 200, response ? response.status() : 0);
    recordCheck('No initial page errors', pageErrors.length === 0, 0, pageErrors.length);

    // 2. Anchor element .items exists with 25 initial items
    const initialItemCount = await page.locator('.items .item').count();
    recordCheck('Initial item count is 25 in .items gallery', initialItemCount === 25, 25, initialItemCount);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-initial.png') });

    // 3. Test click-and-drag interaction
    const sliderBox = await page.locator('.items').boundingBox();
    recordCheck('Gallery container .items has valid dimensions', sliderBox && sliderBox.width > 0, true, !!sliderBox);

    const initialScrollLeft = await page.locator('.items').evaluate((el) => el.scrollLeft);

    // Perform drag gesture: mousedown at right side, move left to drag items forward
    await page.mouse.move(sliderBox.x + 600, sliderBox.y + 100);
    await page.mouse.down();

    const isActiveOnDown = await page.locator('.items').evaluate((el) => el.classList.contains('active'));
    recordCheck('Gallery receives .active class on mousedown', isActiveOnDown, true, isActiveOnDown);

    await page.mouse.move(sliderBox.x + 200, sliderBox.y + 100, { steps: 5 });
    await page.waitForTimeout(100);

    const scrolledLeft = await page.locator('.items').evaluate((el) => el.scrollLeft);
    recordCheck('Mouse dragging scrolls gallery content (scrollLeft > 0)', scrolledLeft > initialScrollLeft, true, scrolledLeft);

    await page.mouse.up();
    const isActiveOnUp = await page.locator('.items').evaluate((el) => el.classList.contains('active'));
    recordCheck('Gallery removes .active class on mouseup', !isActiveOnUp, true, !isActiveOnUp);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-dragged.png') });

    // 4. Test safe text rendering with malicious XSS and HTML payload
    const payload = '<img src="invalid-url" onerror="window.__xss_flag=true"><script>window.__xss_flag=true</script><b>Bold Card</b> & Special "Quotes"';

    await page.fill('#custom-item-input', payload);
    await page.click('#add-item-btn');
    await page.waitForTimeout(100);

    // Assert total items incremented to 26
    const updatedItemCount = await page.locator('.items .item').count();
    recordCheck('Custom item card successfully added to gallery', updatedItemCount === 26, 26, updatedItemCount);

    // Verify XSS handler was NOT executed
    const xssFlag = await page.evaluate(() => window.__xss_flag);
    recordCheck('XSS payload executed zero handlers (window.__xss_flag is undefined)', xssFlag === undefined, undefined, xssFlag);

    // Verify no <img>, <script>, or <b> elements were created inside custom item
    const customItemTags = await page.evaluate(() => {
      const customItem = document.querySelector('.custom-item');
      if (!customItem) return null;
      return {
        scripts: customItem.querySelectorAll('script').length,
        imgs: customItem.querySelectorAll('img').length,
        bolds: customItem.querySelectorAll('b').length,
        rawText: customItem.textContent
      };
    });

    recordCheck('Zero injected script elements created', customItemTags.scripts === 0, 0, customItemTags.scripts);
    recordCheck('Zero injected img elements created', customItemTags.imgs === 0, 0, customItemTags.imgs);
    recordCheck('Zero injected bold elements created', customItemTags.bolds === 0, 0, customItemTags.bolds);
    recordCheck('Fixture string rendered purely as literal textContent', customItemTags.rawText === payload, true, customItemTags.rawText);

    recordCheck('Zero uncaught page errors throughout test execution', pageErrors.length === 0, 0, pageErrors.length);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-safe-text.png') });

    allPassed = checks.every((c) => c.passed) && pageErrors.length === 0;

    // Write results.json
    const summary = {
      task: 'R57-T037',
      page: '27 - Click and Drag/index-START.html',
      browser: 'Chromium',
      checks,
      summary: {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        status: allPassed ? 'PASS' : 'FAIL'
      }
    };

    fs.writeFileSync(path.join(WORK_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`\nSaved test results to ${path.join(WORK_DIR, 'results.json')}`);

    await context.close();
  } catch (err) {
    console.error('Test execution failed:', err);
    allPassed = false;
  } finally {
    await browser.close();
    server.close();
  }

  if (!allPassed) {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${checks.length}/${checks.length} checks passed successfully!`);
    process.exit(0);
  }
}

runChecks();

