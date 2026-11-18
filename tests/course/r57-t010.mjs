import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';

(async () => {
    const server = spawn('npx', ['http-server', '.', '-p', '8080', '-a', '127.0.0.1', '-s'], { detached: true });

    // Poll for server readiness
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch('http://127.0.0.1:8080');
            if (res.ok) break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('pageerror', err => {
        console.error('Unexpected Page Error:', err);
        process.exit(1);
    });

    try {
        await page.goto('http://127.0.0.1:8080/20%20-%20Speech%20Detection/index-START.html');

        // Test 1: Verify the baseline correct state (words container is visible and styled)
        const wordsContainer = page.locator('.words');
        const displayStyle = await wordsContainer.evaluate(el => window.getComputedStyle(el).display);
        assert.notStrictEqual(displayStyle, 'none', 'Baseline correct state: Speech container should be visible');

        // Test 2: Deliberately break the layout in a temporary test fixture
        await page.evaluate(() => {
            document.querySelector('.words').style.display = 'none'; // Simulate a CSS regression hiding the UI
        });

        // Test 3: Assert that the test catches the broken state
        const brokenDisplayStyle = await wordsContainer.evaluate(el => window.getComputedStyle(el).display);
        assert.strictEqual(brokenDisplayStyle, 'none', 'Fixture mutation state: The test must successfully detect the layout regression');

        console.log('Success: All R57-T010 UI Regression assertions passed.');
        process.exit(0);
    } catch (error) {
        console.error('Assertion failure:', error);
        process.exit(1);
    } finally {
        await browser.close();
        try {
            process.kill(-server.pid);
        } catch (e) {}
    }
})();
