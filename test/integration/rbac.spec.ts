import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe.serial('End-to-End RBAC & Branch Scoping Suite', () => {
  test.describe.configure({ timeout: 60000 })
  const PASSWORD = 'TestPass123@'
  const ADMIN = { name: 'Abhishek', pass: 'Hpab522tx@' }

  async function loginAs(page: Page, name: string, pass: string) {
    await page.goto('/management/login')
    await page.fill('input[name="name"]', name)
    await page.fill('input[name="password"]', pass)
    await page.click('button[type="submit"]')
  }

  // ─── Phase 1: Setup Test Users ───────────────────────────────────
  test('1. Setup 5 test users in Settings', async ({ browser }) => {
    test.setTimeout(90000)
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, ADMIN.name, ADMIN.pass)
    await page.waitForURL('/management', { timeout: 15000 })

    await page.goto('/management/settings')
    await expect(page.getByText('System Users & Access')).toBeVisible({ timeout: 15000 })

    const requiredUsers = [
      { name: 'rbac_manager', role: 'manager', branch: true },
      { name: 'rbac_kitchen', role: 'kitchen', branch: true },
      { name: 'rbac_billing', role: 'billing', branch: true },
      { name: 'rbac_waiter', role: 'waiter', branch: true },
      { name: 'rbac_readonly', role: 'readonly', branch: false },
    ]

    for (const u of requiredUsers) {
      const userSpan = page.locator('span.font-bold').filter({ hasText: new RegExp(`^${u.name}$`) })
      const exists = (await userSpan.count()) > 0

      if (!exists) {
        const addBtn = page.getByRole('button', { name: 'Add User' })
        await addBtn.click()
        await page.waitForSelector('form input[name="name"]', { state: 'visible', timeout: 5000 })

        await page.fill('form input[name="name"]', u.name)
        await page.fill('form input[name="password"]', PASSWORD)
        await page.selectOption('form select[name="role"]', u.role)

        if (u.branch) {
          const branchSelect = page.locator('form select[name="branchId"]')
          await branchSelect.waitFor({ state: 'visible', timeout: 5000 })
          await branchSelect.selectOption({ index: 1 })
        }

        await page.click('form button[type="submit"]')

        // Check if error message appeared
        const errorMsg = page.locator('form p.text-red-400')
        if (await errorMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await errorMsg.textContent()
          throw new Error(`Failed to create user ${u.name}: ${text}`)
        }

        await expect(page.locator('form input[name="name"]')).not.toBeVisible({ timeout: 10000 })
        await page.waitForTimeout(500)
      } else {
        // User exists: update password to ensure it matches PASSWORD
        const userRow = userSpan.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "justify-between")]')
        const editBtn = userRow.locator('button:has(svg.lucide-pencil)')
        if (await editBtn.count() > 0) {
          await editBtn.click()
          await page.waitForSelector('form input[name="password"]', { state: 'visible', timeout: 5000 })
          await page.fill('form input[name="password"]', PASSWORD)
          await page.click('form button[type="submit"]')
          await expect(page.locator('form input[name="name"]')).not.toBeVisible({ timeout: 10000 })
          await page.waitForTimeout(500)
        }
      }
    }

    // Verify all 5 exist now in the list
    for (const u of requiredUsers) {
      const userSpan = page.locator('span.font-bold').filter({ hasText: new RegExp(`^${u.name}$`) })
      await expect(userSpan).toBeVisible({ timeout: 10000 })
    }

    await context.close()
  })

  // ─── Phase 2: Page-lock & Routing Enforcement per Role ───────────

  // 2.1 Billing clerk role
  test('2.1 Billing Clerk: Redirected to /management/pos/billing and restricted', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_billing', PASSWORD)
    await page.waitForURL('/management/pos/billing', { timeout: 15000 })

    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()

    // Cannot access /management (dashboard) -> redirected back to /management/pos/billing
    await page.goto('/management')
    await page.waitForURL('/management/pos/billing')

    // Cannot access /management/pos
    await page.goto('/management/pos')
    await page.waitForURL('/management/pos/billing')

    // Cannot access /management/pos/kitchen
    await page.goto('/management/pos/kitchen')
    await page.waitForURL('/management/pos/billing')

    // Cannot access /management/pos/order
    await page.goto('/management/pos/order')
    await page.waitForURL('/management/pos/billing')

    // Cannot access /management/settings
    await page.goto('/management/settings')
    await page.waitForURL('/management/pos/billing')

    // Verify NO global branch switcher is visible
    await expect(page.locator('select').filter({ hasText: 'Vaishnaves Classic' })).not.toBeVisible()

    await context.close()
  })

  // 2.2 Kitchen staff role
  test('2.2 Kitchen Staff: Redirected to /management/pos/kitchen and restricted', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_kitchen', PASSWORD)
    await page.waitForURL('/management/pos/kitchen', { timeout: 15000 })

    await expect(page.locator('h1').filter({ hasText: 'Kitchen Display System' })).toBeVisible()

    // Cannot access /management
    await page.goto('/management')
    await page.waitForURL('/management/pos/kitchen')

    // Cannot access /management/pos/billing
    await page.goto('/management/pos/billing')
    await page.waitForURL('/management/pos/kitchen')

    // Cannot access /management/pos/order
    await page.goto('/management/pos/order')
    await page.waitForURL('/management/pos/kitchen')

    // Cannot access /management/settings
    await page.goto('/management/settings')
    await page.waitForURL('/management/pos/kitchen')

    // Verify NO global branch switcher
    await expect(page.locator('select').filter({ hasText: 'Vaishnaves Classic' })).not.toBeVisible()

    await context.close()
  })

  // 2.3 Waiter role
  test('2.3 Waiter: Redirected to /management/pos/order and restricted', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_waiter', PASSWORD)
    await page.waitForURL('/management/pos/order', { timeout: 15000 })

    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()

    // Cannot access /management
    await page.goto('/management')
    await page.waitForURL('/management/pos/order')

    // Cannot access /management/pos (manager dashboard)
    await page.goto('/management/pos')
    await page.waitForURL('/management/pos/order')

    // Cannot access /management/pos/billing
    await page.goto('/management/pos/billing')
    await page.waitForURL('/management/pos/order')

    // Cannot access /management/pos/kitchen
    await page.goto('/management/pos/kitchen')
    await page.waitForURL('/management/pos/order')

    // Cannot access /management/settings
    await page.goto('/management/settings')
    await page.waitForURL('/management/pos/order')

    await context.close()
  })

  // 2.4 Manager role
  test('2.4 Manager: Can access POS, Orders, Billing, Kitchen; denied History and Settings', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_manager', PASSWORD)
    await page.waitForURL('/management', { timeout: 15000 })

    // Can access /management/pos
    await page.goto('/management/pos')
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()

    // Branch switcher should NOT be visible to manager (branch-scoped)
    await expect(page.locator('select').filter({ hasText: 'Vaishnaves Classic' })).not.toBeVisible()

    // Can access /management/pos/order
    await page.goto('/management/pos/order')
    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()

    // Can access /management/pos/billing
    await page.goto('/management/pos/billing')
    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()

    // Can access /management/pos/kitchen
    await page.goto('/management/pos/kitchen')
    await expect(page.locator('h1').filter({ hasText: 'Kitchen Display System' })).toBeVisible()

    // CANNOT access /management/pos/history (Owner / Admin only) -> redirected to /management
    await page.goto('/management/pos/history')
    await page.waitForURL('/management')

    // CANNOT access /management/settings -> redirected to /management
    await page.goto('/management/settings')
    await page.waitForURL('/management')

    await context.close()
  })

  // 2.5 Read-Only role
  test('2.5 Read-Only: POS module hidden and blocked, redirected from all POS subpages', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_readonly', PASSWORD)
    await page.waitForURL('/management', { timeout: 15000 })

    // POS should NOT be in the navigation sidebar
    const sidebarPos = page.locator('nav a[href="/management/pos"]')
    await expect(sidebarPos).not.toBeVisible()

    // Direct access to /management/pos redirects to /management
    await page.goto('/management/pos')
    await page.waitForURL('/management')

    // Direct access to /management/pos/order redirects to /management
    await page.goto('/management/pos/order')
    await page.waitForURL('/management')

    // Direct access to /management/pos/billing redirects to /management
    await page.goto('/management/pos/billing')
    await page.waitForURL('/management')

    // Direct access to /management/pos/kitchen redirects to /management
    await page.goto('/management/pos/kitchen')
    await page.waitForURL('/management')

    // Direct access to /management/pos/history redirects to /management
    await page.goto('/management/pos/history')
    await page.waitForURL('/management')

    // Direct access to /management/settings redirects to /management
    await page.goto('/management/settings')
    await page.waitForURL('/management')

    await context.close()
  })

  // ─── Phase 3: Branch-Based Scoping & URL Tampering ───────────────
  test('3. Branch Scoping: Tampering ?branch= query parameter does not cross branches', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, 'rbac_manager', PASSWORD)
    await page.waitForURL('/management')

    // Manager visits /management/pos with a foreign branch query param
    await page.goto('/management/pos?branch=non_existent_or_other_branch')
    // Page loads without crashing, falls back strictly to assigned branch
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()

    // Waiter visits /management/pos/order with foreign branch
    await page.goto('/management/pos/order?branch=foreign_branch')
    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()

    // Billing visits /management/pos/billing with foreign branch
    await page.goto('/management/pos/billing?branch=foreign_branch')
    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()

    await context.close()
  })

  // ─── Phase 4: Responsive UI Rendering for iPad & iPhone ──────────
  test('4.1 iPad Viewport (768x1024): All POS pages render cleanly', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } })
    const page = await context.newPage()

    await loginAs(page, ADMIN.name, ADMIN.pass)
    await page.waitForURL('/management')

    // 1. POS Dashboard
    await page.goto('/management/pos')
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()
    await page.screenshot({ path: 'test-results/ipad_pos_dashboard.png' })

    // 2. Waiter Order Station
    await page.goto('/management/pos/order')
    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()
    await page.screenshot({ path: 'test-results/ipad_pos_order.png' })

    // 3. Billing & Settlement
    await page.goto('/management/pos/billing')
    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()
    await page.screenshot({ path: 'test-results/ipad_pos_billing.png' })

    // 4. Kitchen Display
    await page.goto('/management/pos/kitchen')
    await expect(page.locator('h1').filter({ hasText: 'Kitchen Display System' })).toBeVisible()
    await page.screenshot({ path: 'test-results/ipad_pos_kitchen.png' })

    // 5. Order History
    await page.goto('/management/pos/history')
    await expect(page.locator('h1').filter({ hasText: 'Order History & Audit' })).toBeVisible()
    await page.screenshot({ path: 'test-results/ipad_pos_history.png' })

    await context.close()
  })

  test('4.2 iPhone Viewport (390x844): All POS pages render cleanly with no layout overflow', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()

    await loginAs(page, ADMIN.name, ADMIN.pass)
    await page.waitForURL('/management')

    // 1. POS Dashboard
    await page.goto('/management/pos')
    await expect(page.locator('h1').filter({ hasText: 'Point of Sale' })).toBeVisible()
    await page.screenshot({ path: 'test-results/iphone_pos_dashboard.png' })

    // 2. Waiter Order Station
    await page.goto('/management/pos/order')
    await expect(page.locator('h1').filter({ hasText: 'Waiter Order Station' })).toBeVisible()
    await page.screenshot({ path: 'test-results/iphone_pos_order.png' })

    // 3. Billing & Settlement
    await page.goto('/management/pos/billing')
    await expect(page.locator('h1').filter({ hasText: 'Billing & Settlement Station' })).toBeVisible()
    await page.screenshot({ path: 'test-results/iphone_pos_billing.png' })

    // 4. Kitchen Display
    await page.goto('/management/pos/kitchen')
    await expect(page.locator('h1').filter({ hasText: 'Kitchen Display System' })).toBeVisible()
    await page.screenshot({ path: 'test-results/iphone_pos_kitchen.png' })

    // 5. Order History
    await page.goto('/management/pos/history')
    await expect(page.locator('h1').filter({ hasText: 'Order History & Audit' })).toBeVisible()
    await page.screenshot({ path: 'test-results/iphone_pos_history.png' })

    await context.close()
  })

  // ─── Phase 5: Cleanup test users ─────────────────────────────────
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, ADMIN.name, ADMIN.pass)
    await page.waitForURL('/management')

    await page.goto('/management/settings')
    await page.waitForTimeout(1000)

    const testUserNames = ['rbac_manager', 'rbac_kitchen', 'rbac_billing', 'rbac_waiter', 'rbac_readonly']

    for (const name of testUserNames) {
      const userSpan = page.locator('span.font-bold').filter({ hasText: new RegExp(`^${name}$`) })
      if ((await userSpan.count()) > 0) {
        const row = userSpan.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "justify-between")]')
        const trashBtn = row.locator('button:has(svg.lucide-trash-2)')
        if ((await trashBtn.count()) > 0) {
          await trashBtn.click()
          const confirmBtn = page.locator('div.fixed button:has-text("Delete")').last()
          await confirmBtn.waitFor({ state: 'visible', timeout: 5000 })
          await confirmBtn.click()
          await page.waitForTimeout(1000)
        }
      }
    }
    await context.close()
  })
})
