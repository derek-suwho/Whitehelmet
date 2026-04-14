import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { createApp } from 'vue'

// Mock lazy-loaded view components
vi.mock('@/views/LoginView.vue', () => ({ default: { template: '<div>Login</div>' } }))
vi.mock('@/views/WorkspaceView.vue', () => ({ default: { template: '<div>Workspace</div>' } }))
vi.mock('@/views/DashboardView.vue', () => ({ default: { template: '<div>Dashboard</div>' } }))

describe('router', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Install pinia on a dummy app so stores work inside router guards
    const app = createApp({ template: '<div />' })
    app.use(pinia)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unauthenticated user redirected to /login from /', async () => {
    // checkSession returns no user
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
      statusText: 'Unauthorized',
    } as Response)

    // Fresh import to pick up pinia
    const { default: router } = await import('@/router/index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('authenticated user can access /', async () => {
    const mockUser = { id: 1, external_id: 'ext1', email: 'a@b.com', display_name: 'Test' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: mockUser }),
    } as Response)

    const { default: router } = await import('@/router/index')
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('workspace')
  })

  it('authenticated user on /login gets redirected to workspace', async () => {
    const mockUser = { id: 1, external_id: 'ext1', email: 'a@b.com', display_name: 'Test' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: mockUser }),
    } as Response)

    const { default: router } = await import('@/router/index')
    await router.push('/login')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('workspace')
  })
})
