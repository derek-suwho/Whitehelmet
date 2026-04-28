import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '@/types'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)

  function addMessage(text: string, role: ChatMessage['role']) {
    messages.value.push({ role, content: text })
  }

  async function sendMessage(text: string) {
    const aiMsg: ChatMessage = { role: 'ai', content: '' }
    messages.value.push(aiMsg)
    isStreaming.value = true

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          messages: messages.value
            .slice(0, -1) // exclude the empty AI placeholder
            .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        // Keep last potentially-incomplete line in buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data) as { token?: string; error?: string; choices?: { delta?: { content?: string } }[] }
              const token = parsed.token ?? parsed.choices?.[0]?.delta?.content
              if (parsed.error) {
                aiMsg.content += `\n[Error: ${parsed.error}]`
              } else if (token) {
                aiMsg.content += token
              }
            } catch {
              // Non-JSON SSE data — treat as raw token
              aiMsg.content += data
            }
          }
        }
      }

      // Flush remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6)
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data) as { token?: string; choices?: { delta?: { content?: string } }[] }
            const token = parsed.token ?? parsed.choices?.[0]?.delta?.content
            if (token) aiMsg.content += token
          } catch {
            aiMsg.content += data
          }
        }
      }

      if (!aiMsg.content.trim()) {
        aiMsg.content = '[No response received]'
      }
    } catch (err) {
      const idx = messages.value.indexOf(aiMsg)
      if (idx !== -1) {
        messages.value[idx] = {
          role: 'system',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    } finally {
      isStreaming.value = false
    }
  }

  function clear() {
    messages.value = []
    isStreaming.value = false
  }

  return { messages, isStreaming, addMessage, sendMessage, clear }
})
