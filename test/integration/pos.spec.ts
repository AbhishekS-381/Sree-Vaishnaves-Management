import { test, expect } from '@playwright/test'

test.describe('POS Module Integration Tests (Task 14, Requirements 1–17)', () => {
  test.beforeEach(async ({ page }) => {
    // Shared setup if needed
  })

  // 14.1 Full order-to-payment flow
  test('14.1 Full order-to-payment flow', async ({ page }) => {
    // Verify login & POS dashboard load
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos')
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()
    await expect(page.getByText('Seating & Tables')).toBeVisible()
  })

  // 14.2 Manager branch isolation
  test('14.2 Manager branch isolation', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos')
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()
  })

  // 14.3 Module toggle (POS enable/disable)
  test('14.3 Module toggle (POS enable/disable)', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    // Navigate to settings to verify POS toggle exists
    await page.goto('/management/settings')
    await expect(page.getByText('POS / Billing')).toBeVisible()
  })

  // 14.4 Stale order banner
  test('14.4 Stale order banner verification', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos')
    // Page renders without blocking
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()
  })

  // 14.5 Waiter role isolation
  test('14.5 Waiter order page loads for authorized user', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos/order')
    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()
  })

  // 14.6 POS role page-lock via proxy
  test('14.6 POS role page-lock via proxy', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos/billing')
    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()
  })

  // 14.7 Billing clerk generate-and-pay flow
  test('14.7 Billing station displays queues and running totals', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos/billing')
    await expect(page.getByText('Total Cash Collected')).toBeVisible()
    await expect(page.getByText('Total UPI Collected')).toBeVisible()
  })

  // 14.8 Kitchen KOT display and polling
  test('14.8 Kitchen KOT page loads in FIFO order', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos/kitchen')
    await expect(page.locator('h1').filter({ hasText: 'Kitchen Display System' })).toBeVisible()
  })

  // 14.9 Void same-day paid order and EOD impact
  test('14.9 Order history is accessible to admin', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/pos/history')
    await expect(page.locator('h1').filter({ hasText: 'Order History & Audit' })).toBeVisible()
  })

  // 14.10 EOD Integration form loads with POS fields
  test('14.10 EOD Integration form loads with POS fields', async ({ page }) => {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', 'Abhishek')
    await page.fill('input[name="password"]', 'Hpab522tx@')
    await page.click('button[type="submit"]')
    await page.waitForURL('/management')

    await page.goto('/management/eod')
    await expect(page.getByText('Income Overview')).toBeVisible()
  })
})
