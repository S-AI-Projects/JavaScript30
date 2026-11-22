import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const workDir = path.resolve(repoRoot, 'work/R57-T040');

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const PORT = 8740;
let server;
let browser;

const results = {
  task: 'R57-T040',
  timestamp: new Date().toISOString(),
  checks: [],
  passed: 0,
  failed: 0
};

function recordCheck(name, pass, details) {
  results.checks.push({ name, pass, details });
  if (pass) {
    results.passed++;
    console.log(`✅ PASS: ${name} (${JSON.stringify(details)})`);
  } else {
    results.failed++;
    console.error(`❌ FAIL: ${name} (${JSON.stringify(details)})`);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/25 - Event Capture, Propagation, Bubbling and Once/index-START.html';
      const filePath = path.join(repoRoot, decodeURIComponent(reqPath));

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, (err) => {
      if (err) reject(err);
      else resolve(`http://localhost:${PORT}`);
    });
  });
}

async function run() {
  try {
    const baseUrl = await startServer();
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const pageErrors = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const resp = await page.goto(`${baseUrl}/25%20-%20Event%20Capture,%20Propagation,%20Bubbling%20and%20Once/index-START.html`);
    recordCheck('Page responds with HTTP 200', resp.status() === 200, { status: resp.status() });

    // 1. Check skip-link initial off-screen positioning
    const skipLinkInitialTop = await page.$eval('.skip-link', (el) => {
      return parseInt(window.getComputedStyle(el).top);
    });
    recordCheck('Skip link is positioned off-screen initially', skipLinkInitialTop < 0, { top: skipLinkInitialTop });

    // 2. Press Tab to focus the skip-link
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() => document.activeElement ? document.activeElement.className : null);
    const skipLinkFocusedTop = await page.$eval('.skip-link', (el) => parseInt(window.getComputedStyle(el).top));
    const skipLinkOutline = await page.$eval('.skip-link', (el) => {
      const s = window.getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
    });

    const skipVisible = focused1.includes('skip-link') && skipLinkFocusedTop >= 0 && skipLinkOutline.outlineStyle !== 'none';
    recordCheck('Tab focuses skip link and makes it visibly focused', skipVisible, {
      focused: focused1,
      top: skipLinkFocusedTop,
      outline: skipLinkOutline
    });

    await page.screenshot({ path: path.join(workDir, 'skip-link-focused.png') });

    // 3. Press Enter to activate skip link and jump to #main-content
    await page.keyboard.press('Enter');
    const hash = await page.evaluate(() => window.location.hash);
    recordCheck('Activating skip link navigates to #main-content anchor', hash === '#main-content', { hash });

    const focusedAfterSkip = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    recordCheck('Focus shifts to #main-content (.one) after skip link activation', focusedAfterSkip === 'main-content', { focused: focusedAfterSkip });

    // 4. Tab traversal to nested interactive layer two (.two)
    await page.keyboard.press('Tab');
    const activeEl2 = await page.evaluate(() => document.activeElement ? document.activeElement.classList[0] : null);
    recordCheck('Tab navigates to layer two (.two)', activeEl2 === 'two', { active: activeEl2 });

    // 5. Tab traversal to nested interactive layer three (.three)
    await page.keyboard.press('Tab');
    const activeEl3 = await page.evaluate(() => document.activeElement ? document.activeElement.classList[0] : null);
    recordCheck('Tab navigates to layer three (.three)', activeEl3 === 'three', { active: activeEl3 });

    // 6. Verify visible focus outline on interactive layer .three
    const layerOutline = await page.$eval('.three', (el) => {
      const s = window.getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
    });
    recordCheck('Layer three displays visible focus outline', layerOutline.outlineStyle !== 'none' && parseFloat(layerOutline.outlineWidth) > 0, { outline: layerOutline });

    // 7. Keyboard activation of layer three via Enter key
    await page.keyboard.press('Enter');
    const eventLogAfterLayer = await page.evaluate(() => window.__eventLog || []);
    recordCheck('Enter key triggers bubbling events on layer three', eventLogAfterLayer.includes('three'), { eventLog: eventLogAfterLayer });

    // 8. Tab to button control
    await page.keyboard.press('Tab');
    const activeBtn = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    recordCheck('Tab navigates to #once-btn control', activeBtn === 'once-btn', { activeBtn });

    const btnOutline = await page.$eval('#once-btn', (el) => {
      const s = window.getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
    });
    recordCheck('Button displays visible focus outline', btnOutline.outlineStyle !== 'none' && parseFloat(btnOutline.outlineWidth) > 0, { outline: btnOutline });

    await page.screenshot({ path: path.join(workDir, 'controls-keyboard-focused.png') });

    // 9. Keyboard activation of button via Space key
    await page.keyboard.press('Space');
    const eventLogAfterBtn = await page.evaluate(() => window.__eventLog || []);
    recordCheck('Space key activates #once-btn once listener', eventLogAfterBtn.includes('button-clicked'), { eventLog: eventLogAfterBtn });

    // 10. Verify no positive tabindex introduced
    const positiveTabindexCount = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[tabindex]'));
      return els.filter(el => {
        const val = parseInt(el.getAttribute('tabindex'), 10);
        return !isNaN(val) && val > 0;
      }).length;
    });
    recordCheck('Zero positive tabindex attributes introduced', positiveTabindexCount === 0, { positiveTabindexCount });

    // 11. Check for page errors
    recordCheck('Zero uncaught page errors during entire interaction', pageErrors.length === 0, { pageErrors });

    // Save outputs
    fs.writeFileSync(path.join(workDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');
    const versions = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      playwright: '^1.65.1'
    };
    fs.writeFileSync(path.join(workDir, 'versions.json'), JSON.stringify(versions, null, 2), 'utf-8');

    console.log(`\n🎉 Test completed: ${results.passed}/${results.checks.length} checks passed.`);
    if (results.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

run();
