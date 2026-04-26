<script setup lang="ts">
// Script is identical to original — no logic changes.
import { ref, nextTick, watch, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAiOperations } from '@/composables/useAiOperations'

const chat = useChatStore()
const { handleCommand } = useAiOperations()

const input             = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef          = ref<HTMLInputElement | null>(null)

const suggestions = [
  '"Add a Total column"',
  '"Sort rows by date"',
  '"Remove duplicates"',
  '"Summarize this data"',
]

watch(() => chat.messages.length, async () => {
  await nextTick(); scrollToBottom()
})
onMounted(() => inputRef.value?.focus())

function scrollToBottom() {
  if (messagesContainer.value)
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || chat.isStreaming) return
  input.value = ''
  chat.addMessage(text, 'user')
  const handled = await handleCommand(text)
  if (!handled) await chat.sendMessage(text)
}

function fillSuggestion(s: string) {
  input.value = s.replace(/"/g, '')
  inputRef.value?.focus()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}
</script>

<template>
  <!-- Light white AI panel -->
  <aside class="flex flex-col border-l border-border bg-surface-card" aria-label="AI chat">

    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-border px-4 py-3">
      <div class="h-2 w-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" aria-hidden="true" />
      <h2 class="text-sm font-semibold text-gray-800">AI Assistant</h2>
      <span class="ml-auto rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Asif AI
      </span>
    </div>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-4 py-3"
      role="log" aria-live="polite" aria-label="Chat messages"
    >
      <!-- Empty state -->
      <div v-if="chat.messages.length === 0" class="flex h-full flex-col items-center justify-center text-center">
        <svg class="mb-3 h-10 w-10 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <p class="text-sm font-medium text-gray-600">Ask me to edit your spreadsheet</p>
        <p class="mt-1 text-xs leading-relaxed text-gray-400">"Add a Total column" or "Sort by date"</p>
      </div>

      <!-- Message list -->
      <div v-else class="space-y-3">
        <div
          v-for="(msg, i) in chat.messages" :key="i"
          class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed"
            :class="{
              'bg-brand-600 text-white':          msg.role === 'user',
              'bg-gray-100 text-gray-700':        msg.role === 'ai',
              'bg-red-50 text-red-600':           msg.role === 'system',
            }"
          >
            <p class="whitespace-pre-wrap break-words">{{ msg.content }}</p>
          </div>
        </div>

        <!-- Streaming dots -->
        <div v-if="chat.isStreaming" class="flex justify-start">
          <div class="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3.5 py-2.5">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay:0ms"/>
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay:150ms"/>
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay:300ms"/>
          </div>
        </div>
      </div>
    </div>

    <!-- Suggestion chips (only when no messages) -->
    <div v-if="chat.messages.length === 0" class="flex flex-col gap-1.5 px-4 pb-3">
      <button
        v-for="s in suggestions" :key="s"
        type="button"
        class="rounded-lg border border-border bg-surface-light px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
        @click="fillSuggestion(s)"
      >
        {{ s }}
      </button>
    </div>

    <!-- Input -->
    <div class="border-t border-border p-3">
      <div class="flex items-end gap-2">
        <input
          ref="inputRef"
          v-model="input"
          type="text"
          placeholder="Type a command or message…"
          class="flex-1 rounded-lg border border-border bg-surface-light px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
          :disabled="chat.isStreaming"
          @keydown="handleKeydown"
        />
        <button
          type="button"
          :disabled="!input.trim() || chat.isStreaming"
          class="shrink-0 rounded-lg p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          :class="input.trim() && !chat.isStreaming
            ? 'bg-brand-600 text-white hover:bg-brand-700'
            : 'cursor-not-allowed bg-gray-100 text-gray-300'"
          aria-label="Send message"
          @click="sendMessage"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
          </svg>
        </button>
      </div>
    </div>

  </aside>
</template>
