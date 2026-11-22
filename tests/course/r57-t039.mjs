import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const workDir = path.resolve(repoRoot, 'work/R57-T039');

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const PORT = 8739;
let server;
let browser;

const results = {
  task: 'R57-T039',
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
      if (reqPath === '/') reqPath = '/09 - Dev Tools Domination/index-START.html';

      // Serve a mutated fixture if requested
      if (reqPath === '/fixture-mutated.html') {
        const originalPath = path.join(repoRoot, '09 - Dev Tools Domination/index-START.html');
        let content = fs.readFileSync(originalPath, 'utf-8');
        // Deliberately break the event binding in the fixture
        content = content.replace('onClick="makeGreen()"', 'data-broken="true"');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

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

    let totalErrors = 0;

    // -----------------------------------------------------------------
    // Scenario 1: Real application verification (unmutated, correct)
    // -----------------------------------------------------------------
    const realContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const realPage = await realContext.newPage();
    const realErrors = [];
    realPage.on('pageerror', (err) => {
      realErrors.push(err.message);
      totalErrors++;
    });

    const realResp = await realPage.goto(`${baseUrl}/09%20-%20Dev%20Tools%20Domination/index-START.html`);
    recordCheck('Real page responds with HTTP 200', realResp.status() === 200, { status: realResp.status() });

    const pVisible = await realPage.isVisible('p');
    recordCheck('Main rendered paragraph element is visible', pVisible, { visible: pVisible });

    const initialStyle = await realPage.$eval('p', (el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, fontSize: style.fontSize };
    });
    recordCheck('Initial state color is not green', initialStyle.color !== 'rgb(186, 218, 85)', { initialStyle });

    // Click paragraph to trigger makeGreen()
    await realPage.click('p');

    const clickedStyle = await realPage.$eval('p', (el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, fontSize: style.fontSize };
    });
    recordCheck('Correct page applies green color rgb(186, 218, 85) on click', clickedStyle.color === 'rgb(186, 218, 85)', { color: clickedStyle.color });
    recordCheck('Correct page applies 50px font size on click', clickedStyle.fontSize === '50px', { fontSize: clickedStyle.fontSize });

    await realPage.screenshot({ path: path.join(workDir, 'screenshot-correct-state.png') });
    recordCheck('Zero uncaught page errors on real page', realErrors.length === 0, { errors: realErrors });
    await realContext.close();

    // -----------------------------------------------------------------
    // Scenario 2: Deliberately broken event binding in test fixture
    // -----------------------------------------------------------------
    const mutatedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const mutatedPage = await mutatedContext.newPage();
    const mutatedErrors = [];
    mutatedPage.on('pageerror', (err) => {
      mutatedErrors.push(err.message);
      totalErrors++;
    });

    const mutatedResp = await mutatedPage.goto(`${baseUrl}/fixture-mutated.html`);
    recordCheck('Mutated fixture responds with HTTP 200', mutatedResp.status() === 200, { status: mutatedResp.status() });

    // Click paragraph in mutated fixture
    await mutatedPage.click('p');

    const mutatedStyle = await mutatedPage.$eval('p', (el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, fontSize: style.fontSize };
    });

    // The regression trap: assertion verifies the broken binding fails to produce the green style
    const regressionDetected = mutatedStyle.color !== 'rgb(186, 218, 85)' && mutatedStyle.fontSize !== '50px';
    recordCheck('Regression trap: deliberate fixture mutation correctly fails visual transformation', regressionDetected, {
      observedColor: mutatedStyle.color,
      observedFontSize: mutatedStyle.fontSize
    });

    await mutatedPage.screenshot({ path: path.join(workDir, 'screenshot-mutated-state.png') });
    recordCheck('Zero uncaught page errors in mutated fixture scenario', mutatedErrors.length === 0, { errors: mutatedErrors });
    await mutatedContext.close();

    // -----------------------------------------------------------------
    // Scenario 3: Verify production application contains no mutation
    // -----------------------------------------------------------------
    const onDiskFile = fs.readFileSync(path.join(repoRoot, '09 - Dev Tools Domination/index-START.html'), 'utf-8');
    const hasOriginalBinding = onDiskFile.includes('onClick="makeGreen()"');
    const hasOriginalFunction = onDiskFile.includes('function makeGreen()') && onDiskFile.includes('#BADA55');
    recordCheck('Production application on disk remains clean and unmutated', hasOriginalBinding && hasOriginalFunction, {
      hasOriginalBinding,
      hasOriginalFunction
    });

    recordCheck('Overall zero uncaught errors across entire test run', totalErrors === 0, { totalErrors });

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
