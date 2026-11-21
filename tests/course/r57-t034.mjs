import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T034');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8771) {
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
        url: `http://127.0.0.1:${port}/10%20-%20Hold%20Shift%20and%20Check%20Checkboxes/index-START.html`
      });
    });
  });
}

async function runScenarioInContext(browser, url, contextId) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  let pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Intercept any external network requests (such as fav.farm) to guarantee 100% offline determinism
  await page.route('**/*', (route) => {
    const reqUrl = route.request().url();
    if (reqUrl.includes('fav.farm') || !reqUrl.startsWith('http://127.0.0.1')) {
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    } else {
      route.continue();
    }
  });

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response ? response.status() : 0;

  const checkboxes = page.locator('.inbox input[type="checkbox"]');
  const count = await checkboxes.count();

  // Step 1: Click first checkbox (index 0)
  await checkboxes.nth(0).click();

  // Step 2: Shift + Click 5th checkbox (index 4)
  await page.keyboard.down('Shift');
  await checkboxes.nth(4).click();
  await page.keyboard.up('Shift');

  // Step 3: Click 9th checkbox (index 8) without shift
  await checkboxes.nth(8).click();

  // Step 4: Shift + Click 7th checkbox (index 6) (reverse direction in-between check)
  await page.keyboard.down('Shift');
  await checkboxes.nth(6).click();
  await page.keyboard.up('Shift');

  // Collect checked state of all 9 checkboxes
  const checkedStates = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('.inbox input[type="checkbox"]'));
    return boxes.map((b) => b.checked);
  });

  await page.screenshot({ path: path.join(WORK_DIR, `screenshot-context-${contextId}.png`) });

  await context.close();
  return { status, count, checkedStates, pageErrors };
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
    // Run scenario in Context 1
    const res1 = await runScenarioInContext(browser, url, 1);
    recordCheck('Context 1: Page responds with HTTP 200', res1.status === 200, 200, res1.status);
    recordCheck('Context 1: All 9 input anchors present', res1.count === 9, 9, res1.count);
    recordCheck('Context 1: Forward & reverse Shift-check produced expected state',
      JSON.stringify(res1.checkedStates) === JSON.stringify([true, true, true, true, true, false, true, true, true]),
      '[true, true, true, true, true, false, true, true, true]',
      JSON.stringify(res1.checkedStates)
    );
    recordCheck('Context 1: Zero page errors', res1.pageErrors.length === 0, 0, res1.pageErrors.length);

    // Run identical scenario in Context 2 (fresh new browser context)
    const res2 = await runScenarioInContext(browser, url, 2);
    recordCheck('Context 2: Page responds with HTTP 200', res2.status === 200, 200, res2.status);
    recordCheck('Context 2: All 9 input anchors present', res2.count === 9, 9, res2.count);
    recordCheck('Context 2: Forward & reverse Shift-check produced expected state',
      JSON.stringify(res2.checkedStates) === JSON.stringify([true, true, true, true, true, false, true, true, true]),
      '[true, true, true, true, true, false, true, true, true]',
      JSON.stringify(res2.checkedStates)
    );
    recordCheck('Context 2: Zero page errors', res2.pageErrors.length === 0, 0, res2.pageErrors.length);

    // Cross-context determinism assertion:
    const isDeterministic = JSON.stringify(res1.checkedStates) === JSON.stringify(res2.checkedStates);
    recordCheck('Deterministic verification: Context 1 and Context 2 produce identical DOM states', isDeterministic, true, isDeterministic);

    allPassed = checks.every((c) => c.passed);

    // Write results.json
    const summary = {
      task: 'R57-T034',
      page: '10 - Hold Shift and Check Checkboxes/index-START.html',
      browser: 'Chromium',
      context1_state: res1.checkedStates,
      context2_state: res2.checkedStates,
      checks,
      summary: {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        status: allPassed ? 'PASS' : 'FAIL'
      }
    };

    fs.writeFileSync(path.join(WORK_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`\nSaved test results to ${path.join(WORK_DIR, 'results.json')}`);
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
