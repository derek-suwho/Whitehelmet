import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { useFormulasStore } from '@/stores/formulas'

describe('formulas store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initial state is empty', () => {
    const store = useFormulasStore()
    expect(store.formulas).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('fetchFormulas populates store and clears loading', async () => {
    const mockFormulas = [
      { id: 1, name: 'Total Cost', expression: '=A{row}*B{row}', description: null, nl_prompt: null, formula_type: 'calculation', created_at: '2024-01-01' },
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ formulas: mockFormulas, total: 1 }),
    } as Response)

    const store = useFormulasStore()
    await store.fetchFormulas()

    expect(store.formulas).toEqual(mockFormulas)
    expect(store.loading).toBe(false)
  })

  it('fetchFormulas handles error gracefully (no throw)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false, status: 500, text: () => Promise.resolve('Server Error'), statusText: 'Server Error',
    } as Response)

    const store = useFormulasStore()
    await expect(store.fetchFormulas()).resolves.toBeUndefined()
    expect(store.formulas).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('saveFormula posts and prepends to list', async () => {
    const newFormula = { id: 2, name: 'Net Margin', expression: '=(C{row}-B{row})/C{row}', description: 'Net profit margin', nl_prompt: null, formula_type: 'calculation', created_at: '2024-02-01' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, status: 201,
      json: () => Promise.resolve(newFormula),
    } as Response)

    const store = useFormulasStore()
    store.formulas = [
      { id: 1, name: 'Total Cost', expression: '=A{row}*B{row}', description: null, nl_prompt: null, formula_type: 'calculation', created_at: '2024-01-01' },
    ]

    const result = await store.saveFormula({ name: 'Net Margin', expression: '=(C{row}-B{row})/C{row}' })
    expect(result).toEqual(newFormula)
    expect(store.formulas[0].id).toBe(2)
    expect(store.formulas).toHaveLength(2)
  })

  it('deleteFormula removes by id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response)

    const store = useFormulasStore()
    store.formulas = [
      { id: 1, name: 'F1', expression: '=A{row}', description: null, nl_prompt: null, formula_type: 'calculation', created_at: '2024-01-01' },
      { id: 2, name: 'F2', expression: '=B{row}', description: null, nl_prompt: null, formula_type: 'calculation', created_at: '2024-01-01' },
    ]

    await store.deleteFormula(1)
    expect(store.formulas).toHaveLength(1)
    expect(store.formulas[0].id).toBe(2)
  })

  it('findByName returns matching formula case-insensitively', () => {
    const store = useFormulasStore()
    store.formulas = [
      { id: 1, name: 'Total Cost', expression: '=A{row}*B{row}', description: null, nl_prompt: null, formula_type: 'calculation', created_at: '2024-01-01' },
    ]

    expect(store.findByName('Total Cost')).toBeDefined()
    expect(store.findByName('total cost')).toBeDefined()
    expect(store.findByName('TOTAL COST')).toBeDefined()
    expect(store.findByName('Revenue')).toBeUndefined()
  })

  it('createFromNL calls /api/ai/formula then saves', async () => {
    const aiResp = { expression: '=A{row}*B{row}', name: 'Total Cost', description: 'A times B', formula_type: 'calculation' }
    const savedResp = { id: 5, name: 'Total Cost', expression: '=A{row}*B{row}', description: 'A times B', nl_prompt: 'multiply A by B', formula_type: 'calculation', created_at: '2024-01-01' }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(aiResp) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(savedResp) } as Response)

    const store = useFormulasStore()
    const result = await store.createFromNL('multiply A by B', ['ColA', 'ColB'])

    expect(result.name).toBe('Total Cost')
    expect(result.expression).toBe('=A{row}*B{row}')
    expect(store.formulas).toHaveLength(1)
    // Verify the AI endpoint was called with the right payload
    const firstCall = vi.mocked(fetch).mock.calls[0]
    expect(firstCall[0]).toContain('/api/ai/formula')
    const body = JSON.parse(firstCall[1]?.body as string)
    expect(body.nl_request).toBe('multiply A by B')
    expect(body.column_headers).toEqual(['ColA', 'ColB'])
  })
})
