<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFormulasStore } from '@/stores/formulas'
import { detectedFormulas } from '@/composables/useSpreadsheetEditor'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import type { SavedFormula } from '@/types'

const formulaStore = useFormulasStore()
const spreadsheet = useSpreadsheetStore()

const applyTarget = ref<{ formula: SavedFormula; column: string } | null>(null)
const showApplyModal = ref(false)
const columnInput = ref('')
const pendingScrape = ref<{ column: string; expression: string }[]>([])

onMounted(() => formulaStore.fetchFormulas())

function openApplyModal(formula: SavedFormula) {
  applyTarget.value = { formula, column: '' }
  columnInput.value = ''
  showApplyModal.value = true
}

async function confirmApply() {
  if (!applyTarget.value || !columnInput.value.trim()) return
  const jss = spreadsheet.instance
  if (!jss) return
  const formula = applyTarget.value.formula
  const col = columnInput.value.trim()
  const headers: string[] = jss.getConfig?.()?.columns?.map((c: any) => String(c.title ?? c.name ?? '')) ?? []
  const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase())
  if (idx === -1) { alert(`Column "${col}" not found.`); return }
  const rowCount = (jss.getData?.() ?? []).length
  for (let r = 0; r < rowCount; r++) {
    jss.setValueFromCoords(idx, r, formula.expression.replace(/\{row\}/gi, String(r + 1)))
  }
  showApplyModal.value = false
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
    <div class="px-3 py-2 border-b border-gray-200 font-semibold text-gray-700 flex items-center justify-between">
      <span>Formula Library</span>
      <button
        v-if="detectedFormulas.length"
        class="text-xs text-blue-600 hover:underline"
        @click="openScrapePanel"
      >
        {{ detectedFormulas.length }} detected
      </button>
    </div>

    <!-- Scrape panel -->
    <div v-if="pendingScrape.length" class="p-2 bg-blue-50 border-b border-blue-200">
      <p class="text-xs text-blue-700 mb-1 font-medium">Formulas detected in imported file:</p>
      <div v-for="item in pendingScrape" :key="item.expression" class="flex items-center gap-2 mb-1">
        <span class="flex-1 truncate text-xs font-mono text-gray-700">{{ item.column }}: {{ item.expression }}</span>
        <button class="text-xs text-blue-600 hover:underline" @click="saveScrapped(item)">Save</button>
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
        class="px-3 py-2 border-b border-gray-100 hover:bg-gray-50"
      >
        <div class="flex items-start justify-between gap-1">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 truncate">{{ formula.name }}</p>
            <p class="font-mono text-xs text-blue-700 truncate">{{ formula.expression }}</p>
            <p v-if="formula.description" class="text-xs text-gray-500 mt-0.5 truncate">{{ formula.description }}</p>
          </div>
          <div class="flex flex-col gap-1 shrink-0">
            <button
              class="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              @click="openApplyModal(formula)"
            >Apply</button>
            <button
              class="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
              @click="formulaStore.deleteFormula(formula.id)"
            >Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Apply modal -->
    <div v-if="showApplyModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-4 w-72">
        <p class="font-semibold mb-2">Apply "{{ applyTarget?.formula.name }}"</p>
        <p class="text-xs text-gray-500 mb-3">Enter the column name to apply the formula to:</p>
        <input
          v-model="columnInput"
          class="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Total Cost"
          @keydown.enter="confirmApply"
        />
        <div class="flex gap-2 justify-end">
          <button class="text-sm text-gray-600 hover:underline" @click="showApplyModal = false">Cancel</button>
          <button
            class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            @click="confirmApply"
          >Apply</button>
        </div>
      </div>
    </div>
  </div>
</template>
