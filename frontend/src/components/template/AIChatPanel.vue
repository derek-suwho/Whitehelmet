<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { api } from '@/composables/useApi'

const props = defineProps<{
  mode: 'template-builder' | 'consolidation-finetune'
  templateId?: string
  consolidatedSheetId?: string
  currentColumns?: { id: string; name: string; type: string }[]
}>()

const emit = defineEmits<{
  'schema-generated': [schemaJson: object]
  'finetune-applied': []
}>()

interface Message { role: 'user' | 'assistant'; content: string }

const MAX_MESSAGES = 100

function storageKey() {
  return `wh_chat_${props.templateId ?? 'new'}`
}

function loadMessages(): Message[] {
  if (props.mode === 'consolidation-finetune') return []
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) return JSON.parse(raw) as Message[]
  } catch {}
  return []
}

function saveMessages(msgs: Message[]) {
  if (props.mode === 'consolidation-finetune') return
  const trimmed = msgs.slice(-MAX_MESSAGES)
  try { localStorage.setItem(storageKey(), JSON.stringify(trimmed)) } catch {}
}

const messages = ref<Message[]>(loadMessages())
const input = ref('')
const loading = ref(false)
const error = ref('')
const scrollEl = ref<HTMLElement | null>(null)

watch(messages, (msgs) => {
  saveMessages(msgs)
  nextTick(() => { if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight })
}, { deep: true })

onMounted(() => {
  nextTick(() => { if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight })
})

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  error.value = ''
  try {
    if (props.mode === 'template-builder') await sendTemplateBuilder(text)
    else await sendFinetune(text)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function sendTemplateBuilder(prompt: string) {
  const history = messages.value.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))
  const data = await api.post<{ schema_json?: object; message?: string }>(
    '/api/ai/template-generate',
    { prompt, messages: history, existing_columns: props.currentColumns ?? [] },
  )
  if (data?.schema_json) {
    emit('schema-generated', data.schema_json)
    const colCount = (data.schema_json as { columns: unknown[] }).columns?.length ?? 0
    messages.value.push({
      role: 'assistant',
      content: `Generated a template with ${colCount} column${colCount !== 1 ? 's' : ''}. Review and adjust in the editor.`,
    })
  } else if (data?.message) {
    messages.value.push({ role: 'assistant', content: data.message })
  }
}

async function sendFinetune(prompt: string) {
  if (!props.consolidatedSheetId) throw new Error('No consolidated sheet selected')
  const data = await api.post<{ message: string }>('/api/ai/finetune', {
    consolidated_sheet_id: props.consolidatedSheetId,
    prompt,
  })
  emit('finetune-applied')
  messages.value.push({ role: 'assistant', content: data?.message ?? 'Changes applied.' })
}
</script>

<template>
  <div class="flex flex-col h-full bg-white border-l border-gray-200">
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <span class="font-medium text-sm text-gray-700">{{ mode === 'template-builder' ? 'Build with AI' : 'AI Fine-Tuning' }}</span>
      <button
        v-if="messages.length"
        class="text-xs text-gray-400 hover:text-red-500 transition-colors"
        @click="messages = []; saveMessages([])"
      >Clear</button>
    </div>

    <div ref="scrollEl" class="flex-1 overflow-y-auto p-4 space-y-3">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="max-w-[85%] rounded-lg px-3 py-2 text-sm"
        :class="msg.role === 'user'
          ? 'ml-auto bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-800'"
      >
        {{ msg.content }}
      </div>

      <div v-if="loading" class="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500 w-fit">
        <span class="animate-pulse">Thinking…</span>
      </div>

      <div v-if="!messages.length && !loading" class="text-sm text-gray-400 text-center py-8">
        <template v-if="mode === 'template-builder'">
          Describe the template structure and I'll generate the columns for you.
        </template>
        <template v-else>
          Describe a change and I'll apply it to the master sheet.
        </template>
      </div>
    </div>

    <div v-if="error" class="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
      {{ error }}
    </div>

    <div class="p-3 border-t border-gray-200 flex gap-2">
      <input
        v-model="input"
        type="text"
        :placeholder="mode === 'template-builder' ? 'Describe your template...' : 'Describe a change...'"
        class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        @keydown.enter="send"
      />
      <button
        :disabled="!input.trim() || loading"
        class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="send"
      >
        Send
      </button>
    </div>
  </div>
</template>
