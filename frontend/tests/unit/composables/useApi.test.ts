import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { api, ApiError } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

describe('useApi', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('api.get makes GET fetch call', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    } as Response)

    const result = await api.get('/api/test')
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'GET' }))
    expect(result).toEqual({ data: 'ok' })
  })

  it('api.post makes POST with JSON body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    } as Response)

    await api.post('/api/items', { name: 'test' })

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    expect(opts!.method).toBe('POST')
    expect((opts as any).body).toBe(JSON.stringify({ name: 'test' }))
  })

  it('api.delete makes DELETE call', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response)

    const result = await api.delete('/api/items/1')
    expect(fetch).toHaveBeenCalledWith('/api/items/1', expect.objectContaining({ method: 'DELETE' }))
    expect(result).toBeUndefined()
  })

  it('api.upload sends FormData', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ uploaded: true }),
    } as Response)

    const file = new File(['data'], 'test.xlsx', { type: 'application/octet-stream' })
    await api.upload('/api/upload', file)

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    expect(opts!.method).toBe('POST')
    expect((opts as any).body).toBeInstanceOf(FormData)
  })

  it('CSRF token injected in headers when set', async () => {
    const auth = useAuthStore()
    auth.csrfToken = 'my-csrf-token'

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response)

    await api.get('/api/test')

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const headers = opts!.headers as Record<string, string>
    expect(headers['X-CSRF-Token']).toBe('my-csrf-token')
  })

  it('ApiError thrown on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
      statusText: 'Forbidden',
    } as Response)

    await expect(api.get('/api/secret')).rejects.toThrow(ApiError)
    try {
      await api.get('/api/secret')
    } catch (e) {
      // Already verified above
    }
  })

  it('204 returns undefined', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response)

    const result = await api.get('/api/empty')
    expect(result).toBeUndefined()
  })

  it('no Content-Type header on upload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response)

    const file = new File(['data'], 'test.xlsx')
    await api.upload('/api/upload', file)

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const headers = opts!.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })
})
