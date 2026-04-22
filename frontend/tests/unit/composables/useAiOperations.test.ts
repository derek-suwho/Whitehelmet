import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { useAiOperations } from '@/composables/useAiOperations'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useChatStore } from '@/stores/chat'

describe('useAiOperations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleCommand returns false when no spreadsheet instance', async () => {
    const { handleCommand } = useAiOperations()
    const result = await handleCommand('add column')
    expect(result).toBe(false)
  })

  it('handleCommand returns false when no headers', async () => {
    const spreadsheet = useSpreadsheetStore()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [] }),
      getData: () => [],
    }

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('add column')
    expect(result).toBe(false)
  })

  it('handleCommand success returns true and adds ai message', async () => {
    const spreadsheet = useSpreadsheetStore()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }, { title: 'Value' }] }),
      getData: () => [['a', '1'], ['b', '2']],
      insertColumn: vi.fn(),
      setHeader: vi.fn(),
      setValueFromCoords: vi.fn(),
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: true,
            operation: { type: 'add_column', params: { title: 'Total', position: 2 } },
            message: 'Added Total column',
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('add a Total column')

    expect(result).toBe(true)
    const chat = useChatStore()
    expect(chat.messages.some((m) => m.content === 'Added Total column')).toBe(true)
  })

  it('handleCommand with null operation returns false', async () => {
    const spreadsheet = useSpreadsheetStore()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }] }),
      getData: () => [['a']],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: false,
            operation: null,
            message: null,
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('do something weird')
    expect(result).toBe(false)
  })

  it('handleCommand error adds system message and returns false', async () => {
    const spreadsheet = useSpreadsheetStore()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }] }),
      getData: () => [['a']],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal error'),
      statusText: 'Internal Server Error',
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('break things')

    expect(result).toBe(false)
    const chat = useChatStore()
    expect(chat.messages.some((m) => m.role === 'system' && m.content.includes('Command failed'))).toBe(true)
  })

  it('handleCommand with remove_column operation', async () => {
    const spreadsheet = useSpreadsheetStore()
    const deleteColumn = vi.fn()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }, { title: 'Value' }] }),
      getData: () => [['a', '1']],
      deleteColumn,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: true,
            operation: { type: 'remove_column', params: { column: 'Value' } },
            message: 'Removed Value column',
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('remove Value column')
    expect(result).toBe(true)
    expect(deleteColumn).toHaveBeenCalledWith(1, 1)
  })

  it('handleCommand with sort operation', async () => {
    const spreadsheet = useSpreadsheetStore()
    const orderBy = vi.fn()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }, { title: 'Value' }] }),
      getData: () => [['a', '1']],
      orderBy,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: true,
            operation: { type: 'sort', params: { column: 'Name', ascending: true } },
            message: 'Sorted by Name',
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('sort by Name')
    expect(result).toBe(true)
    expect(orderBy).toHaveBeenCalledWith(0, 0)
  })

  it('handleCommand with rename_column operation', async () => {
    const spreadsheet = useSpreadsheetStore()
    const setHeader = vi.fn()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Name' }] }),
      getData: () => [['a']],
      setHeader,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: true,
            operation: { type: 'rename_column', params: { column: 'Name', new_name: 'FullName' } },
            message: 'Renamed',
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('rename Name to FullName')
    expect(result).toBe(true)
    expect(setHeader).toHaveBeenCalledWith(0, 'FullName')
  })

  it('handleCommand with apply_formula operation', async () => {
    const spreadsheet = useSpreadsheetStore()
    const setValueFromCoords = vi.fn()
    spreadsheet.instance = {
      getConfig: () => ({ columns: [{ title: 'Total' }] }),
      getData: () => [['10'], ['20']],
      setValueFromCoords,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            handled: true,
            operation: { type: 'apply_formula', params: { column: 'Total', formula: '=A{ROW}*2' } },
            message: 'Applied formula',
          },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('multiply Total by 2')
    expect(result).toBe(true)
    expect(setValueFromCoords).toHaveBeenCalledTimes(2)
    expect(setValueFromCoords).toHaveBeenCalledWith(0, 0, '=A1*2')
    expect(setValueFromCoords).toHaveBeenCalledWith(0, 1, '=A2*2')
  })

  it('handleCommand uses fallback headers from first data row when no columns config', async () => {
    const spreadsheet = useSpreadsheetStore()
    spreadsheet.instance = {
      getConfig: () => ({}),
      getData: () => [['Name', 'Age'], ['Alice', '30']],
      options: {},
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { handled: false },
        }),
    } as Response)

    const { handleCommand } = useAiOperations()
    const result = await handleCommand('do something')
    // It should reach the API call (headers extracted from first row)
    expect(fetch).toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
