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

    // Check for unexpected page errors (allow expected caught clock error log)
    page.on('pageerror', err => {
        console.error('Unexpected Page Error:', err);
        process.exit(1);
    });

    try {
        await page.goto('http://127.0.0.1:8080/02%20-%20JS%20and%20CSS%20Clock/index-START.html');

        const clock = page.locator('.clock');

        // Test 1: Trigger the error state by passing an invalid Date object
        await page.evaluate(() => {
            window.setDate(new Date('Invalid String'));
        });

        let hasErrorClass = await clock.evaluate(el => el.classList.contains('error'));
        assert.strictEqual(hasErrorClass, true, 'Clock should apply the .error class when an invalid date is processed');

        // Test 2: Ensure the clock recovers when valid input is restored
        await page.evaluate(() => {
            window.setDate(new Date());
        });

        hasErrorClass = await clock.evaluate(el => el.classList.contains('error'));
        assert.strictEqual(hasErrorClass, false, 'Clock should remove the .error class and recover upon valid input');

        console.log('Success: All R57-T003 empty/error display assertions passed.');
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
