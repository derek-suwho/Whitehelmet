import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useSpreadsheetStore } from '@/stores/spreadsheet'

describe('spreadsheet store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state is all null', () => {
    const store = useSpreadsheetStore()
    expect(store.instance).toBeNull()
    expect(store.workbook).toBeNull()
    expect(store.fileName).toBeNull()
  })

  it('setInstance sets all three values', () => {
    const store = useSpreadsheetStore()
    const mockJss = { getData: vi.fn() }
    const mockWb = { SheetNames: ['Sheet1'] }
    store.setInstance(mockJss, mockWb, 'test.xlsx')

    expect(store.instance).toBe(mockJss)
    expect(store.workbook).toBe(mockWb)
    expect(store.fileName).toBe('test.xlsx')
  })

  it('clear destroys instance and nullifies', () => {
    const store = useSpreadsheetStore()
    const destroy = vi.fn()
    store.setInstance({ destroy }, {}, 'test.xlsx')

    store.clear()
    expect(destroy).toHaveBeenCalledOnce()
    expect(store.instance).toBeNull()
    expect(store.workbook).toBeNull()
    expect(store.fileName).toBeNull()
  })

  it('clear with no instance does not call destroy', () => {
    const store = useSpreadsheetStore()
    // Should not throw
    store.clear()
    expect(store.instance).toBeNull()
  })
})
