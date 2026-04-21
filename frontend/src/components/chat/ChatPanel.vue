<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAiOperations } from '@/composables/useAiOperations'

const chat = useChatStore()
const { handleCommand } = useAiOperations()

const input = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

// Scroll to bottom when new messages arrive
watch(
  () => chat.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)

onMounted(() => {
  inputRef.value?.focus()
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || chat.isStreaming) return

  input.value = ''

  // handleCommand adds the user message internally
  const handled = await handleCommand(text)
  if (handled) return

  // Regular chat — add user message here since sendMessage no longer does it
  chat.addMessage(text, 'user')
  await chat.sendMessage(text)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <aside
    class="flex w-[360px] shrink-0 flex-col border-l border-white/5 bg-surface"
    aria-label="AI chat"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-white/5 px-4 py-3">
      <div class="h-2 w-2 rounded-full bg-brand-400 shadow-sm shadow-brand-400/50" aria-hidden="true" />
      <h2 class="font-display text-sm font-semibold tracking-wide text-gray-200">AI Assistant</h2>
    </div>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-4 py-3"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <!-- Empty state -->
      <div
        v-if="chat.messages.length === 0"
        class="flex h-full flex-col items-center justify-center text-center"
      >
        <svg
          class="mb-3 h-10 w-10 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        <p class="text-sm text-gray-500">Ask me to edit your spreadsheet</p>
        <p class="mt-1 text-xs leading-relaxed text-gray-600">
          "Add a Total column" or "Sort by date"
        </p>
      </div>

      <!-- Message list -->
      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="(msg, i) in chat.messages"
          :key="i"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed"
            :class="{
              'bg-brand-600/20 text-brand-100': msg.role === 'user',
              'bg-surface-lighter text-gray-300': msg.role === 'ai',
              'bg-red-500/10 text-red-300': msg.role === 'system',
            }"
          >
            <p class="whitespace-pre-wrap break-words">{{ msg.content }}</p>
          </div>
        </div>

        <!-- Streaming indicator -->
        <div
          v-if="chat.isStreaming"
          class="flex justify-start"
        >
          <div class="flex items-center gap-1.5 rounded-xl bg-surface-lighter px-3.5 py-2.5">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay: 0ms" />
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay: 150ms" />
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style="animation-delay: 300ms" />
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-white/5 p-3">
      <div class="flex items-end gap-2">
        <input
          ref="inputRef"
          v-model="input"
          type="text"
          placeholder="Type a command or message..."
          class="flex-1 rounded-lg border border-white/10 bg-surface-lighter px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          :disabled="chat.isStreaming"
          aria-label="Chat message input"
          @keydown="handleKeydown"
        />
        <button
          type="button"
          :disabled="!input.trim() || chat.isStreaming"
          class="shrink-0 rounded-lg p-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          :class="
            input.trim() && !chat.isStreaming
              ? 'bg-brand-500 text-surface shadow-lg shadow-brand-500/20 hover:bg-brand-400 active:bg-brand-600'
              : 'cursor-not-allowed bg-white/5 text-gray-600'
          "
          aria-label="Send message"
          @click="sendMessage"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>
