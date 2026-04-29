<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFormulasStore } from '@/stores/formulas'
import { detectedFormulas, selectedCol, getColumnHeadersExternal, applyFormulaToColumn } from '@/composables/useSpreadsheetEditor'
import type { SavedFormula } from '@/types'

const formulaStore = useFormulasStore()

const applyingId = ref<number | null>(null)
const pendingScrape = ref<{ column: string; expression: string }[]>([])
const applyFeedback = ref<string>('')
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => formulaStore.fetchFormulas())

const applyColumns = computed(() => {
  if (applyingId.value === null) return []
  return getColumnHeadersExternal()
})

function showFeedback(msg: string) {
  applyFeedback.value = msg
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { applyFeedback.value = '' }, 2500)
}

function toggleApply(formula: SavedFormula) {
  if (applyingId.value === formula.id) {
    applyingId.value = null
    return
  }
  const cols = getColumnHeadersExternal()
  if (!cols.length) {
    showFeedback('Open a spreadsheet first.')
    return
  }
  applyingId.value = formula.id
}

function applyToColumn(formula: SavedFormula, colIdx: number) {
  const applied = applyFormulaToColumn(formula.expression, colIdx)
  if (!applied) {
    showFeedback('No data rows to apply to.')
    return
  }
  const cols = getColumnHeadersExternal()
  const colLabel = cols.find(c => c.idx === colIdx)
  showFeedback(`Applied to ${colLabel ? `"${colLabel.name}"` : `column ${colIdx + 1}`} (${applied} rows).`)
  applyingId.value = null
}

function openScrapePanel() {
  pendingScrape.value = detectedFormulas.value.map((f) => ({ ...f }))
}

async function saveScrapped(item: { column: string; expression: string }) {
  await formulaStore.saveFormula({
    name: item.column,
    expression: item.expression,
    formula_type: 'calculation',
  })
  pendingScrape.value = pendingScrape.value.filter((f) => f.expression !== item.expression)
}
</script>

<template>
  <div class="formula-panel flex flex-col h-full bg-white border-l border-gray-200 text-sm">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-gray-200 font-semibold text-gray-700 flex items-center justify-between shrink-0">
      <span>Formula Library</span>
      <button
        v-if="detectedFormulas.length"
        class="text-xs text-blue-600 hover:underline"
        @click="openScrapePanel"
      >
        {{ detectedFormulas.length }} detected
      </button>
    </div>

    <!-- Feedback toast -->
    <div
      v-if="applyFeedback"
      class="mx-2 mt-2 px-3 py-1.5 rounded text-xs bg-green-50 text-green-700 border border-green-200 shrink-0"
    >
      {{ applyFeedback }}
    </div>

    <!-- Scrape panel -->
    <div v-if="pendingScrape.length" class="p-2 bg-blue-50 border-b border-blue-200 shrink-0">
      <p class="text-xs text-blue-700 mb-1 font-medium">Formulas detected in imported file:</p>
      <div v-for="item in pendingScrape" :key="item.expression" class="flex items-center gap-2 mb-1">
        <span class="flex-1 truncate text-xs font-mono text-gray-700">{{ item.column }}: {{ item.expression }}</span>
        <button class="text-xs text-blue-600 hover:underline shrink-0" @click="saveScrapped(item)">Save</button>
      </div>
    </div>

    <!-- Formula list -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="formulaStore.loading" class="p-3 text-gray-400 text-xs">Loading…</div>
      <div v-else-if="!formulaStore.formulas.length" class="p-3 text-gray-400 text-xs">
        No saved formulas yet. Ask the AI to create one or import a file with formulas.
      </div>

      <div
        v-for="formula in formulaStore.formulas"
        :key="formula.id"
        class="border-b border-gray-100"
      >
        <!-- Formula card -->
        <div class="px-3 py-2 hover:bg-gray-50">
          <div class="flex items-start justify-between gap-1">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800 truncate">{{ formula.name }}</p>
              <p class="font-mono text-xs text-blue-700 truncate">{{ formula.expression }}</p>
              <p v-if="formula.description" class="text-xs text-gray-500 mt-0.5 truncate">{{ formula.description }}</p>
            </div>
            <div class="flex flex-col gap-1 shrink-0">
              <button
                class="text-xs px-2 py-0.5 rounded text-white"
                :class="applyingId === formula.id ? 'bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'"
                @click="toggleApply(formula)"
              >
                {{ applyingId === formula.id ? 'Cancel' : 'Apply' }}
              </button>
              <button
                class="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                @click="formulaStore.deleteFormula(formula.id)"
              >Delete</button>
            </div>
          </div>
        </div>

        <!-- Inline column picker — shown when this formula's Apply is active -->
        <div v-if="applyingId === formula.id" class="px-3 pb-3 bg-blue-50 border-t border-blue-100">
          <p class="text-xs text-blue-700 font-medium pt-2 mb-1.5">
            Click a column to apply this formula to all its rows:
          </p>
          <div v-if="!applyColumns.length" class="text-xs text-gray-500 italic">
            No spreadsheet open — load a file first.
          </div>
          <div v-else class="flex flex-wrap gap-1">
            <button
              v-for="col in applyColumns"
              :key="col.idx"
              class="inline-flex items-center gap-0.5 text-xs px-2 py-1 rounded border transition-colors"
              :class="col.idx === selectedCol
                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400'"
              :title="`Apply formula to column ${col.letter}: ${col.name}`"
              @click="applyToColumn(formula, col.idx)"
            >
              <span class="font-mono font-bold">{{ col.letter }}</span>
              <span class="text-current opacity-50 mx-px">:</span>
              <span class="max-w-[72px] truncate">{{ col.name }}</span>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-2 leading-tight">
            Blue = column currently selected in spreadsheet.
            Formula uses <code class="bg-white px-0.5 rounded">A</code>, <code class="bg-white px-0.5 rounded">B</code>… to reference other columns by position.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
