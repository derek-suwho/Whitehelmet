<script setup lang="ts">
import { ref } from 'vue'
import SourcesPanel from '@/components/sources/SourcesPanel.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import FormulaLibraryPanel from '@/components/formulas/FormulaLibraryPanel.vue'

const leftTab = ref<'sources' | 'formulas'>('sources')
</script>

<template>
  <div class="flex flex-1 overflow-hidden pt-14">
    <div class="flex h-full w-full flex-col md:flex-row">
      <!-- Left panel with Sources / Formula Library tabs -->
      <div class="flex flex-col w-full shrink-0 md:w-[280px] border-r border-gray-200">
        <div class="flex border-b border-gray-200 bg-gray-50">
          <button
            class="flex-1 py-1.5 text-xs font-medium"
            :class="leftTab === 'sources' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'"
            @click="leftTab = 'sources'"
          >Sources</button>
          <button
            class="flex-1 py-1.5 text-xs font-medium"
            :class="leftTab === 'formulas' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'"
            @click="leftTab = 'formulas'"
          >Formulas</button>
        </div>
        <SourcesPanel v-show="leftTab === 'sources'" class="flex-1 overflow-hidden" />
        <FormulaLibraryPanel v-show="leftTab === 'formulas'" class="flex-1 overflow-hidden" />
      </div>

      <SpreadsheetEditor class="min-h-[300px] flex-1" />
      <ChatPanel class="w-full shrink-0 md:w-[360px]" />
    </div>
  </div>
</template>
