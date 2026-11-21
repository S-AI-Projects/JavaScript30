import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T033');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8770) {
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
        url: `http://127.0.0.1:${port}/22%20-%20Follow%20Along%20Link%20Highlighter/index-START.html`
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
    page.on('pageerror', (err) => {
      console.error('Page error detected:', err);
      pageErrors.push(err.message);
    });

    // 1. Initial page load
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Page responds with HTTP 200', response && response.status() === 200, 200, response ? response.status() : 0);
    recordCheck('No page errors on initial load', pageErrors.length === 0, 0, pageErrors.length);

    // 2. Anchor elements exist
    const anchorCount = await page.locator('a').count();
    recordCheck('Anchor elements present in DOM', anchorCount >= 10, true, anchorCount);

    // 3. Highlight element created once
    const initialHighlightCount = await page.locator('.highlight').count();
    recordCheck('Exactly one highlight element created on load', initialHighlightCount === 1, 1, initialHighlightCount);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-initial.png') });

    // 4. Hover over first link ('Home')
    const firstLink = page.locator('a').first();
    await firstLink.hover();
    await page.waitForTimeout(100);

    const highlightStyle1 = await page.locator('.highlight').evaluate((el) => ({
      width: parseFloat(el.style.width),
      height: parseFloat(el.style.height),
      transform: el.style.transform
    }));
    recordCheck('Highlight dimensions update upon link hover', highlightStyle1.width > 0 && highlightStyle1.height > 0, true, JSON.stringify(highlightStyle1));

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-hover.png') });

    // 5. Test repeat initialization (call initFollowAlongLinks 3 times)
    await page.evaluate(() => {
      window.initFollowAlongLinks();
      window.initFollowAlongLinks();
      window.initFollowAlongLinks();
    });

    const repeatHighlightCount = await page.locator('.highlight').count();
    recordCheck('No duplicate DOM nodes after 3x repeat initialization', repeatHighlightCount === 1, 1, repeatHighlightCount);

    // 6. Test interaction after repeat initialization
    const secondLink = page.locator('nav ul li a').nth(1);
    await secondLink.hover();
    await page.waitForTimeout(100);

    const highlightStyle2 = await page.locator('.highlight').evaluate((el) => ({
      width: parseFloat(el.style.width),
      transform: el.style.transform
    }));
    recordCheck('Highlight continues working seamlessly after repeat init', highlightStyle2.width > 0 && highlightStyle2.transform !== highlightStyle1.transform, true, JSON.stringify(highlightStyle2));

    // 7. Test keyboard focus support
    const thirdLink = page.locator('nav ul li a').nth(2);
    await thirdLink.focus();
    await page.waitForTimeout(100);

    const highlightStyle3 = await page.locator('.highlight').evaluate((el) => ({
      width: parseFloat(el.style.width),
      transform: el.style.transform
    }));
    recordCheck('Keyboard focus activates link highlighter', highlightStyle3.width > 0 && highlightStyle3.transform !== highlightStyle2.transform, true, JSON.stringify(highlightStyle3));

    // 8. Test cleanup / destroyFollowAlongLinks
    await page.evaluate(() => {
      window.destroyFollowAlongLinks();
    });

    const destroyedHighlightCount = await page.locator('.highlight').count();
    recordCheck('destroyFollowAlongLinks cleans up highlight DOM element', destroyedHighlightCount === 0, 0, destroyedHighlightCount);

    // Hover links when destroyed - no errors and no highlight recreated
    await firstLink.hover();
    await page.waitForTimeout(50);
    const postDestroyHighlightCount = await page.locator('.highlight').count();
    recordCheck('No highlight element recreated after destroy', postDestroyHighlightCount === 0, 0, postDestroyHighlightCount);

    // 9. Re-initialize after teardown
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
      window.initFollowAlongLinks();
    });
    const reinitHighlightCount = await page.locator('.highlight').count();
    recordCheck('Re-initialization successfully restores single highlight element', reinitHighlightCount === 1, 1, reinitHighlightCount);

    await firstLink.hover();
    await page.waitForTimeout(100);
    const reinitHighlightWidth = await page.locator('.highlight').evaluate((el) => parseFloat(el.style.width));
    recordCheck('Highlight functions correctly after re-initialization', reinitHighlightWidth > 0, true, reinitHighlightWidth);

    recordCheck('Zero uncaught page errors throughout entire lifecycle', pageErrors.length === 0, 0, pageErrors.length);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-reinit.png') });

    allPassed = checks.every((c) => c.passed) && pageErrors.length === 0;

    // Write results.json
    const summary = {
      task: 'R57-T033',
      page: '22 - Follow Along Link Highlighter/index-START.html',
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
