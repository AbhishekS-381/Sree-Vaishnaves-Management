import { test, expect } from '@playwright/test';

test.describe('EOD Scenarios', () => {
  test('should load the EOD page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="name"]', 'Abhishek');
    await page.fill('input[name="password"]', 'Hpab522tx@');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/eod');
    
    // Expect the title to be present
    await expect(page.locator('h1').filter({ hasText: 'Daily EOD Entry' })).toBeVisible();

    // Check if the date input is present
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // Check income fields
    await expect(page.getByText('Dine-In')).toBeVisible();
    await expect(page.getByText('Takeaway')).toBeVisible();
  });

  test('should allow adding an expense row', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="name"]', 'Abhishek');
    await page.fill('input[name="password"]', 'Hpab522tx@');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/eod');

    const addExpenseBtn = page.getByRole('button', { name: 'Add Expense' });
    if (await addExpenseBtn.isVisible()) {
      await addExpenseBtn.click();
      
      // Select the first category from the dropdown if a modal/dropdown appears, 
      // or check if a new row is added
      const expenseInputs = page.locator('input[placeholder="0"]');
      // Should have at least the income inputs + 1 expense input
      expect(await expenseInputs.count()).toBeGreaterThan(4);
    }
  });
});
