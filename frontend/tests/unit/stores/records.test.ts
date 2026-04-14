import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { useRecordsStore } from '@/stores/records'

describe('records store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loading starts false', () => {
    const store = useRecordsStore()
    expect(store.loading).toBe(false)
    expect(store.records).toEqual([])
  })

  it('fetchRecords success sets records and toggles loading', async () => {
    const mockRecords = [
      { id: 1, name: 'rec1', source_count: 2, row_count: 10, col_count: 3, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ records: mockRecords, total: 1 }),
    } as Response)

    const store = useRecordsStore()
    await store.fetchRecords()

    expect(store.records).toEqual(mockRecords)
    expect(store.loading).toBe(false)
  })

  it('fetchRecords error throws and loading becomes false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
      statusText: 'Internal Server Error',
    } as Response)

    const store = useRecordsStore()
    await expect(store.fetchRecords()).rejects.toThrow()
    expect(store.loading).toBe(false)
  })

  it('createRecord adds to front of records', async () => {
    const newRec = { id: 2, name: 'new', source_count: 1, row_count: 5, col_count: 2, created_at: '2024-02-01', updated_at: '2024-02-01' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(newRec),
    } as Response)

    const store = useRecordsStore()
    store.records = [
      { id: 1, name: 'old', source_count: 1, row_count: 1, col_count: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]

    const result = await store.createRecord({ name: 'new', headers: ['A'], rows: [['1']] })
    expect(result).toEqual(newRec)
    expect(store.records[0].id).toBe(2)
    expect(store.records).toHaveLength(2)
  })

  it('deleteRecord removes from records', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response)

    const store = useRecordsStore()
    store.records = [
      { id: 1, name: 'r1', source_count: 1, row_count: 1, col_count: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 2, name: 'r2', source_count: 1, row_count: 1, col_count: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]

    await store.deleteRecord(1)
    expect(store.records).toHaveLength(1)
    expect(store.records[0].id).toBe(2)
  })
})
