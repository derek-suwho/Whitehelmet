<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import SourcesPanel      from '@/components/sources/SourcesPanel.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import ChatPanel         from '@/components/chat/ChatPanel.vue'
import FormulaLibraryPanel from '@/components/formulas/FormulaLibraryPanel.vue'

// ── Resizable panels ────────────────────────────────────────────
const sourcesWidth = ref(220)   // px
const chatWidth    = ref(280)   // px
const leftTab      = ref<'sources' | 'formulas'>('sources')

let dragging: 'sources' | 'chat' | null = null
let startX = 0
let startW = 0

function onMouseDown(panel: 'sources' | 'chat', e: MouseEvent) {
  dragging = panel
  startX   = e.clientX
  startW   = panel === 'sources' ? sourcesWidth.value : chatWidth.value
  document.body.style.cursor    = 'col-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!dragging) return
  const delta = e.clientX - startX
  if (dragging === 'sources') {
    sourcesWidth.value = Math.min(400, Math.max(160, startW + delta))
  } else {
    chatWidth.value = Math.min(500, Math.max(200, startW - delta))
  }
}

function onMouseUp() {
  if (!dragging) return
  dragging = null
  document.body.style.cursor    = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup',   onMouseUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup',   onMouseUp)
})
</script>

<template>
  <div class="flex flex-1 overflow-hidden bg-surface-light pt-14">
    <div class="flex h-full w-full">

      <!-- Left panel (Sources / Formulas tabs) -->
      <div class="flex shrink-0 flex-col border-r border-border" :style="{ width: sourcesWidth + 'px' }">
        <!-- Tab bar -->
        <div class="flex border-b border-border bg-surface-card">
          <button
            class="flex-1 py-1.5 text-xs font-medium"
            :class="leftTab === 'sources' ? 'border-b-2 border-brand-600 bg-white text-brand-600' : 'text-gray-500 hover:text-gray-700'"
            @click="leftTab = 'sources'"
          >Sources</button>
          <button
            class="flex-1 py-1.5 text-xs font-medium"
            :class="leftTab === 'formulas' ? 'border-b-2 border-brand-600 bg-white text-brand-600' : 'text-gray-500 hover:text-gray-700'"
            @click="leftTab = 'formulas'"
          >Formulas</button>
        </div>
        <SourcesPanel v-show="leftTab === 'sources'" class="flex-1 overflow-hidden" />
        <FormulaLibraryPanel v-show="leftTab === 'formulas'" class="flex-1 overflow-hidden" />
      </div>

      <!-- Sources resize handle -->
      <div
        class="group relative z-10 w-1 shrink-0 cursor-col-resize bg-border hover:bg-brand-600/30 active:bg-brand-600/50"
        @mousedown="onMouseDown('sources', $event)"
      >
        <div class="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-brand-600/20" />
      </div>

      <!-- Spreadsheet editor -->
      <SpreadsheetEditor class="min-w-0 flex-1" />

      <!-- Chat resize handle -->
      <div
        class="group relative z-10 w-1 shrink-0 cursor-col-resize bg-border hover:bg-brand-600/30 active:bg-brand-600/50"
        @mousedown="onMouseDown('chat', $event)"
      >
        <div class="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-brand-600/20" />
      </div>

      <!-- Chat panel -->
      <ChatPanel :style="{ width: chatWidth + 'px' }" class="shrink-0" />

    </div>
  </div>
</template>
