import { test, expect, type Page } from '@playwright/test'

const TEST_USER = {
  id: 1,
  external_id: 'ext-1',
  email: 'test@test.com',
  display_name: 'Test User',
}

const MOCK_RECORDS = [
  {
    id: 1,
    name: 'Q1 Report',
    source_count: 3,
    row_count: 150,
    col_count: 8,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'Q2 Report',
    source_count: 5,
    row_count: 200,
    col_count: 10,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
  },
]

async function setupAuthenticatedDashboard(page: Page) {
  // Auth mock
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: TEST_USER }),
    }),
  )

  // Records mock
  await page.route('**/api/records', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: MOCK_RECORDS, total: MOCK_RECORDS.length }),
      })
    }
    return route.continue()
  })
}

test.describe('Dashboard', () => {
  test('records list renders', async ({ page }) => {
    await setupAuthenticatedDashboard(page)
    await page.goto('/dashboard')

    // Verify heading
    await expect(page.locator('h1', { hasText: 'Master Records' })).toBeVisible()

    // Verify both records are visible
    await expect(page.getByText('Q1 Report')).toBeVisible()
    await expect(page.getByText('Q2 Report')).toBeVisible()

    // Verify stats are shown
    await expect(page.getByText('3 sources')).toBeVisible()
    await expect(page.getByText('150 rows')).toBeVisible()
    await expect(page.getByText('5 sources')).toBeVisible()
    await expect(page.getByText('200 rows')).toBeVisible()

    // Verify record cards rendered as articles
    const articles = page.locator('article')
    await expect(articles).toHaveCount(2)
  })

  test('delete record removes it from list', async ({ page }) => {
    await setupAuthenticatedDashboard(page)

    // Mock DELETE endpoint
    await page.route('**/api/records/1', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 204, body: '' })
      }
      return route.continue()
    })

    await page.goto('/dashboard')

    // Verify both records visible initially
    await expect(page.locator('article')).toHaveCount(2)

    // Click delete on first record (aria-label="Delete Q1 Report")
    // Need to force-click since the button is opacity-0 until hover
    await page.getByRole('button', { name: 'Delete Q1 Report' }).click({ force: true })

    // After deletion, only one record should remain
    await expect(page.locator('article')).toHaveCount(1)
    await expect(page.getByText('Q1 Report')).not.toBeVisible()
    await expect(page.getByText('Q2 Report')).toBeVisible()
  })

  test('navigate to workspace via Back button', async ({ page }) => {
    await setupAuthenticatedDashboard(page)
    await page.goto('/dashboard')

    await expect(page).toHaveURL('/dashboard')

    // Click "Back to Workspace"
    await page.getByRole('button', { name: 'Back to Workspace' }).click()

    // Should navigate to /
    await expect(page).toHaveURL('/')
  })
})
