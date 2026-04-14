import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { useChatStore } from '@/stores/chat'

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('isStreaming starts false and messages empty', () => {
    const chat = useChatStore()
    expect(chat.isStreaming).toBe(false)
    expect(chat.messages).toEqual([])
  })

  it('addMessage pushes to messages', () => {
    const chat = useChatStore()
    chat.addMessage('hello', 'user')
    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0]).toEqual({ role: 'user', content: 'hello' })

    chat.addMessage('hi back', 'ai')
    expect(chat.messages).toHaveLength(2)
    expect(chat.messages[1].role).toBe('ai')
  })

  it('sendMessage streams SSE tokens into ai message', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"token":"Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"token":" World"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: { getReader: () => stream.getReader() },
    } as any)

    const chat = useChatStore()
    await chat.sendMessage('test')

    // Should have user message + ai message
    expect(chat.messages).toHaveLength(2)
    expect(chat.messages[0]).toEqual({ role: 'user', content: 'test' })
    expect(chat.messages[1].role).toBe('ai')
    expect(chat.messages[1].content).toBe('Hello World')
    expect(chat.isStreaming).toBe(false)
  })

  it('sendMessage error replaces ai message with system error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
      statusText: 'Internal Server Error',
    } as Response)

    const chat = useChatStore()
    await chat.sendMessage('fail')

    expect(chat.messages).toHaveLength(2)
    // The ai message should be replaced with system error
    expect(chat.messages[1].role).toBe('system')
    expect(chat.messages[1].content).toContain('Error')
    expect(chat.isStreaming).toBe(false)
  })

  it('clear empties messages and sets isStreaming false', () => {
    const chat = useChatStore()
    chat.addMessage('msg', 'user')
    chat.clear()
    expect(chat.messages).toEqual([])
    expect(chat.isStreaming).toBe(false)
  })
})
