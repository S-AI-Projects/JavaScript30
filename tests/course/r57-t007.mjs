import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

(async () => {
    // Check 1: Verify the walkthrough documentation exists and covers required sections
    const walkthroughPath = path.resolve('29 - Countdown Timer/WALKTHROUGH.md');
    assert.strictEqual(fs.existsSync(walkthroughPath), true, 'WALKTHROUGH.md must exist in the example directory');
    const docContent = fs.readFileSync(walkthroughPath, 'utf8');
    assert.ok(docContent.includes('## Prerequisites'), 'Walkthrough must document Prerequisites');
    assert.ok(docContent.includes('## Step-by-Step Reproduction'), 'Walkthrough must document Step-by-Step Reproduction');
    assert.ok(docContent.includes('## Expected Results'), 'Walkthrough must document Expected Results');

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
        await page.goto('http://127.0.0.1:8080/29%20-%20Countdown%20Timer/index.html');

        // Test 2: Execute preset button interaction from walkthrough
        const firstButton = page.locator('.timer__button').first();
        await firstButton.waitFor();
        await firstButton.click();

        await page.waitForTimeout(300);

        const timeLeft = await page.locator('.display__time-left').textContent();
        assert.notStrictEqual(timeLeft, '', 'Timer display should show remaining time after clicking a preset');

        const endTime = await page.locator('.display__end-time').textContent();
        assert.ok(endTime.includes('Be Back At'), 'End time display should indicate scheduled return time');

        // Test 3: Execute custom minutes submission from walkthrough
        const customInput = page.locator('input[name="minutes"]');
        await customInput.fill('5');
        await customInput.press('Enter');

        await page.waitForTimeout(300);

        const customTimeLeft = await page.locator('.display__time-left').textContent();
        assert.ok(customTimeLeft.includes(':'), 'Timer display should update with custom countdown time');

        console.log('Success: All R57-T007 Countdown Timer assertions passed.');
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
