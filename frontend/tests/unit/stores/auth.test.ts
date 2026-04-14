import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checked starts false', () => {
    const auth = useAuthStore()
    expect(auth.checked).toBe(false)
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBe('')
  })

  it('checkSession success sets user and checked', async () => {
    const mockUser = { id: 1, external_id: 'ext1', email: 'a@b.com', display_name: 'Test' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: mockUser }),
    } as Response)

    const auth = useAuthStore()
    await auth.checkSession()

    expect(auth.user).toEqual(mockUser)
    expect(auth.checked).toBe(true)
  })

  it('checkSession failure sets user null and checked true', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'))

    const auth = useAuthStore()
    await auth.checkSession()

    expect(auth.user).toBeNull()
    expect(auth.checked).toBe(true)
  })

  it('login success sets user and csrfToken', async () => {
    const mockUser = { id: 2, external_id: 'ext2', email: 'b@c.com', display_name: 'User2' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { user: mockUser, csrf_token: 'tok123' } }),
    } as Response)

    const auth = useAuthStore()
    await auth.login('user', 'pass')

    expect(auth.user).toEqual(mockUser)
    expect(auth.csrfToken).toBe('tok123')
  })

  it('login error throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
      statusText: 'Unauthorized',
    } as Response)

    const auth = useAuthStore()
    await expect(auth.login('bad', 'creds')).rejects.toThrow()
  })

  it('logout clears user and csrfToken', async () => {
    // Setup: login first
    const mockUser = { id: 1, external_id: 'ext1', email: 'a@b.com', display_name: 'Test' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { user: mockUser, csrf_token: 'tok' } }),
    } as Response)

    const auth = useAuthStore()
    await auth.login('user', 'pass')
    expect(auth.user).not.toBeNull()

    // Logout
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response)

    await auth.logout()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBe('')
  })
})
