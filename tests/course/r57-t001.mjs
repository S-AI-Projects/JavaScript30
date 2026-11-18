import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';

(async () => {
    // Start local server
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

    // Check for unexpected page errors
    page.on('pageerror', err => {
        console.error('Unexpected Page Error:', err);
        process.exit(1);
    });

    try {
        await page.goto('http://127.0.0.1:8080/30%20-%20Whack%20A%20Mole/index-START.html');

        // Test 1: Visible focus traversal on moles without positive tabindex
        const firstMole = page.locator('.mole').first();
        const tabIndex = await firstMole.getAttribute('tabindex');
        assert.strictEqual(tabIndex, '0', 'Mole elements should have tabindex="0" and not positive values');

        await firstMole.focus();
        const outlineStyle = await page.evaluate(() => {
            const mole = document.querySelector('.mole:focus');
            return mole ? window.getComputedStyle(mole).outlineStyle : 'none';
        });
        assert.notStrictEqual(outlineStyle, 'none', 'Focus outline should be visible on moles');

        // Test 2: Keyboard Activation via Enter key
        await page.keyboard.press('Enter');
        const score = await page.locator('.score').textContent();
        assert.strictEqual(score, '1', 'Score should increment to 1 after keyboard activation (Enter)');

        console.log('Success: All R57-T001 assertions passed.');
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
