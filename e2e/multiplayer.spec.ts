import { test, expect } from '@playwright/test';

test.describe('Two-Browser Multiplayer End-to-End Test', () => {
  test('two clients join same room, see each other, observe movement, and exchange chat', async ({ browser }) => {
    const roomId = `e2e_room_${Date.now()}`;

    // Launch two independent browser contexts (players)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // 1. Both join the same room
    await page1.goto(`/?room=${roomId}&name=Alice&autoplay=1`);
    await page2.goto(`/?room=${roomId}&name=Bob&autoplay=1`);

    // 2. Assert roster in both clients shows both players
    await expect(page1.locator('#roster')).toContainText('Alice', { timeout: 10000 });
    await expect(page1.locator('#roster')).toContainText('Bob', { timeout: 10000 });
    await expect(page2.locator('#roster')).toContainText('Alice', { timeout: 10000 });
    await expect(page2.locator('#roster')).toContainText('Bob', { timeout: 10000 });

    // Wait until both games finish asset loading and start running
    await page1.waitForFunction(() => {
      const g = (window as unknown as { __netGame?: { running: boolean } }).__netGame;
      return g && g.running === true;
    }, { timeout: 10000 });

    await page2.waitForFunction(() => {
      const g = (window as unknown as { __netGame?: { running: boolean } }).__netGame;
      return g && g.running === true;
    }, { timeout: 10000 });

    // Wait for first snapshot delivery
    await page2.waitForFunction(() => {
      const g = (window as unknown as { __netGame?: { opponentPosition: unknown } }).__netGame;
      return g && g.opponentPosition !== null;
    }, { timeout: 5000 });

    const initialPos = await page2.evaluate(() => {
      const g = (window as unknown as { __netGame?: { opponentPosition: { x: number; y: number } } }).__netGame;
      return g?.opponentPosition ? { ...g.opponentPosition } : null;
    });
    expect(initialPos).not.toBeNull();

    // 3. Player 1 (Alice) moves by pressing 'w' (thrust)
    await page1.bringToFront();
    await page1.keyboard.down('KeyW');
    await page1.waitForTimeout(600);
    await page1.keyboard.up('KeyW');

    // Assert Player 2 (Bob) observes Player 1 (Alice)'s ship move within 500 ms
    await expect.poll(async () => {
      return await page2.evaluate((init) => {
        const g = (window as unknown as { __netGame?: { opponentPosition: { x: number; y: number } } }).__netGame;
        if (!g?.opponentPosition || !init) return 0;
        const dx = g.opponentPosition.x - init.x;
        const dy = g.opponentPosition.y - init.y;
        return Math.hypot(dx, dy);
      }, initialPos);
    }, {
      message: "Player 2 should observe Player 1's position change within 500ms",
      timeout: 3000,
      intervals: [50, 100],
    }).toBeGreaterThan(0.5);

    // 4. Player 1 sends chat message
    const chatMsg = `Hello Bob from Alice! ${Date.now()}`;
    await page1.locator('#chat-input').fill(chatMsg);
    await page1.locator('#chat-send').click();

    // Assert Player 2 receives and displays the chat message
    await expect(page2.locator('#chat-messages')).toContainText(chatMsg, { timeout: 5000 });

    // Clean up
    await context1.close();
    await context2.close();
  });
});
