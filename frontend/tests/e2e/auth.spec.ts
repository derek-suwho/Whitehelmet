import { test, expect, type Page } from '@playwright/test'

const TEST_USER = {
  id: 1,
  external_id: 'ext-1',
  email: 'test@test.com',
  display_name: 'Test User',
}

async function mockUnauthenticated(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    }),
  )
}

async function mockAuthenticated(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: TEST_USER }),
    }),
  )
}

test.describe('Authentication', () => {
  test('login page renders when unauthenticated', async ({ page }) => {
    await mockUnauthenticated(page)
    await page.goto('/login')

    // Verify branding
    await expect(page.locator('h1', { hasText: 'Whitehelmet' })).toBeVisible()

    // Verify form elements
    await expect(page.locator('#login-username')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    // Verify labels
    await expect(page.getByText('Username')).toBeVisible()
    await expect(page.getByText('Password')).toBeVisible()
  })

  test('login form submit redirects to workspace', async ({ page }) => {
    // Start unauthenticated
    await mockUnauthenticated(page)

    // Mock login endpoint
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: TEST_USER,
            csrf_token: 'test-csrf-token',
          },
        }),
      }),
    )

    await page.goto('/login')

    // Fill form
    await page.locator('#login-username').fill('testuser')
    await page.locator('#login-password').fill('testpass')

    // After login succeeds, /me should return authenticated
    // Unroute the old unauthenticated mock before setting up the new one
    await page.unroute('**/api/auth/me')
    await mockAuthenticated(page)

    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should redirect to workspace (/)
    await expect(page).toHaveURL('/')
  })

  test('logout redirects to login', async ({ page }) => {
    await mockAuthenticated(page)

    // Mock logout endpoint
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      }),
    )

    // Mock endpoints that workspace child components might call
    await page.route('**/api/records*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [], total: 0 }),
      }),
    )

    await page.goto('/')
    await expect(page).toHaveURL('/')

    // After logout, /me should return 401
    await page.unroute('**/api/auth/me')
    await mockUnauthenticated(page)

    // Click logout button (aria-label="Log out")
    await page.getByRole('button', { name: 'Log out' }).click()

    // Should redirect to /login
    await expect(page).toHaveURL('/login')
  })
})
