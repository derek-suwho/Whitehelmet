<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useRecordsStore } from '@/stores/records'
import {
  useSpreadsheetEditor,
  sheetNames,
  currentSheetIdx,
  zoomLevel,
  formulaRef,
  formulaValue,
  fmtState,
  lastTextColor,
  lastFillColor,
} from '@/composables/useSpreadsheetEditor'

const spreadsheet = useSpreadsheetStore()
const records = useRecordsStore()

const {
  openFile,
  closeFile,
  switchSheet,
  stepZoom,
  toolbarAction,
  setNumFormat,
  handleFormulaEnter,
  handleFormulaEscape,
  showColorPicker,
  downloadXlsx,
  wireKeyboardShortcuts,
  cleanupKeyboardShortcuts,
} = useSpreadsheetEditor()

// Save bar / modal state
const showSaveModal = ref(false)
const saveName = ref('')
const saving = ref(false)
const saveError = ref('')

const zoomPercent = computed(() => Math.round(zoomLevel.value * 100) + '%')

watch(
  () => spreadsheet.workbook,
  async (wb) => {
    if (!wb) return
    await nextTick()
    openFile(wb)
  },
)

onMounted(() => {
  wireKeyboardShortcuts()
  if (spreadsheet.workbook) {
    openFile(spreadsheet.workbook)
  }
})

onBeforeUnmount(() => {
  cleanupKeyboardShortcuts()
})

function handleDownload() {
  downloadXlsx(spreadsheet.fileName ?? 'spreadsheet.xlsx')
}

function handleClose() {
  showSaveModal.value = false
  spreadsheet.clearPendingSave()
  closeFile()
}

function openSaveModal() {
  saveName.value = spreadsheet.fileName?.replace(/\.xlsx$/i, '') ?? 'Consolidated'
  saveError.value = ''
  showSaveModal.value = true
}

async function handleSave() {
  if (!saveName.value.trim()) {
    saveError.value = 'Name is required.'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const data = spreadsheet.pendingSave
    if (!data) throw new Error('No data to save.')
    await records.createRecord({ name: saveName.value.trim(), headers: data.headers, rows: data.rows })
    showSaveModal.value = false
    spreadsheet.clearPendingSave()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

function onColorBtn(e: MouseEvent, type: 'text' | 'fill') {
  showColorPicker(e.currentTarget as HTMLElement, type)
}
</script>

<template>
  <main
    class="flex flex-1 flex-col overflow-hidden bg-surface-light"
    aria-label="Spreadsheet editor"
  >
    <!-- ── Toolbar ── -->
    <div
      v-if="spreadsheet.fileName"
      class="flex flex-wrap items-center gap-0.5 border-b border-white/5 bg-surface px-2 py-1"
    >
      <!-- File name -->
      <span class="mr-2 flex items-center gap-1.5 text-xs text-gray-400">
        <svg class="h-3.5 w-3.5 text-green-500/70" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd"/>
        </svg>
        {{ spreadsheet.fileName }}
      </span>

      <div class="xt-sep" />

      <!-- Undo / Redo -->
      <button type="button" class="xt-btn" title="Undo (Ctrl+Z)" @click="toolbarAction('undo')">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
      </button>
      <button type="button" class="xt-btn" title="Redo (Ctrl+Y)" @click="toolbarAction('redo')">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/></svg>
      </button>

      <div class="xt-sep" />

      <!-- Bold / Italic / Underline -->
      <button type="button" :class="['xt-btn font-bold', fmtState.bold && 'xt-btn-active']" title="Bold (Ctrl+B)" @click="toolbarAction('bold')">B</button>
      <button type="button" :class="['xt-btn italic', fmtState.italic && 'xt-btn-active']" title="Italic (Ctrl+I)" @click="toolbarAction('italic')">I</button>
      <button type="button" :class="['xt-btn underline', fmtState.underline && 'xt-btn-active']" title="Underline (Ctrl+U)" @click="toolbarAction('underline')">U</button>

      <div class="xt-sep" />

      <!-- Text color -->
      <button type="button" class="xt-btn xt-color-btn" title="Text color" @click="onColorBtn($event, 'text')">
        <span class="text-xs leading-none">A</span>
        <span class="xt-color-bar" :style="{ backgroundColor: lastTextColor }" />
      </button>
      <!-- Fill color -->
      <button type="button" class="xt-btn xt-color-btn" title="Fill color" @click="onColorBtn($event, 'fill')">
        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
        <span class="xt-color-bar" :style="{ backgroundColor: lastFillColor }" />
      </button>

      <div class="xt-sep" />

      <!-- Alignment -->
      <button type="button" :class="['xt-btn', fmtState.align === 'left' && 'xt-btn-active']" title="Align left" @click="toolbarAction('align-left')">
        <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm0 5a1 1 0 011-1h8a1 1 0 110 2H3a1 1 0 01-1-1zm0 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
      </button>
      <button type="button" :class="['xt-btn', fmtState.align === 'center' && 'xt-btn-active']" title="Align center" @click="toolbarAction('align-center')">
        <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm3 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-3 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
      </button>
      <button type="button" :class="['xt-btn', fmtState.align === 'right' && 'xt-btn-active']" title="Align right" @click="toolbarAction('align-right')">
        <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm5 5a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1zm-5 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
      </button>

      <div class="xt-sep" />

      <!-- Merge / Wrap -->
      <button type="button" class="xt-btn text-[10px]" title="Merge cells" @click="toolbarAction('merge')">Merge</button>
      <button type="button" :class="['xt-btn', fmtState.wrapText && 'xt-btn-active']" title="Wrap text" @click="toolbarAction('wrap')">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h12a4 4 0 010 8H8m0 0l3-3m-3 3l3 3"/></svg>
      </button>

      <div class="xt-sep" />

      <!-- Number format -->
      <select class="xt-select" title="Number format" :value="fmtState.numFormat" @change="setNumFormat(($event.target as HTMLSelectElement).value)">
        <option value="">Default</option>
        <option value="number">Number</option>
        <option value="currency">Currency</option>
        <option value="percent">Percent</option>
        <option value="date">Date</option>
      </select>

      <div class="xt-sep" />

      <!-- Row / Col ops -->
      <button type="button" class="xt-btn text-[10px]" title="Insert row above" @click="toolbarAction('insert-row')">+Row</button>
      <button type="button" class="xt-btn text-[10px]" title="Insert column left" @click="toolbarAction('insert-col')">+Col</button>
      <button type="button" class="xt-btn text-[10px]" title="Delete selected row(s)" @click="toolbarAction('delete-row')">-Row</button>
      <button type="button" :class="['xt-btn text-[10px]', fmtState.freeze && 'xt-btn-active']" title="Freeze first row" @click="toolbarAction('freeze')">Freeze</button>

      <div class="xt-sep" />

      <!-- Find -->
      <button type="button" class="xt-btn" title="Find & Replace (Ctrl+F)" @click="toolbarAction('find')">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </button>

      <div class="xt-sep" />

      <!-- Zoom -->
      <button type="button" class="xt-btn" title="Zoom out" @click="stepZoom(-0.1)">−</button>
      <span class="xt-zoom-label">{{ zoomPercent }}</span>
      <button type="button" class="xt-btn" title="Zoom in" @click="stepZoom(0.1)">+</button>
      <button type="button" class="xt-btn text-[10px]" title="Reset zoom" @click="toolbarAction('zoom-reset')">Reset</button>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Download / Close -->
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
        @click="handleDownload"
      >
        Download
      </button>
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-red-400"
        @click="handleClose"
      >
        Close
      </button>
    </div>

    <!-- ── Formula bar ── -->
    <div v-if="spreadsheet.fileName" class="xt-formula-bar">
      <span class="xt-cell-ref">{{ formulaRef }}</span>
      <span class="xt-formula-sep" />
      <input
        id="xt-formula-input"
        class="xt-formula-input"
        :value="formulaValue"
        spellcheck="false"
        @input="formulaValue = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="handleFormulaEnter"
        @keydown.escape.prevent="handleFormulaEscape"
      />
    </div>

    <!-- ── Save bar (shown after consolidation) ── -->
    <div
      v-if="spreadsheet.pendingSave"
      class="flex items-center gap-3 border-b border-brand-500/20 bg-brand-500/10 px-4 py-2"
    >
      <svg class="h-4 w-4 shrink-0 text-brand-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
      </svg>
      <span class="flex-1 text-xs text-gray-300">Save this consolidation to master records?</span>
      <button
        type="button"
        class="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-brand-400 transition-colors"
        @click="openSaveModal"
      >
        Save
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        @click="spreadsheet.clearPendingSave()"
      >
        Dismiss
      </button>
    </div>

    <!-- ── Spreadsheet container ── -->
    <div
      v-if="spreadsheet.fileName"
      id="spreadsheet-container"
      class="flex-1 overflow-auto"
    />

    <!-- ── Sheet tabs ── -->
    <div v-if="sheetNames.length > 1" class="xt-sheet-tabs">
      <button
        v-for="(name, idx) in sheetNames"
        :key="idx"
        type="button"
        :class="['xt-sheet-tab', idx === currentSheetIdx && 'active']"
        @click="switchSheet(idx)"
      >
        {{ name }}
      </button>
    </div>

    <!-- ── Empty state ── -->
    <div
      v-if="!spreadsheet.fileName"
      class="flex flex-1 flex-col items-center justify-center"
    >
      <div class="text-center">
        <svg
          class="mx-auto mb-4 h-16 w-16 text-gray-700/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m1.125-2.625c-.621 0-1.125.504-1.125 1.125"
          />
        </svg>
        <h3 class="font-display text-lg text-gray-400">No spreadsheet open</h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-600">
          Upload and consolidate files from the<br />Sources panel to get started.
        </p>
      </div>
    </div>

    <!-- ── Save modal ── -->
    <Teleport to="body">
      <div
        v-if="showSaveModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showSaveModal = false"
      >
        <div class="w-80 rounded-xl border border-white/10 bg-surface-light p-6 shadow-2xl">
          <h3 class="mb-4 font-display text-base font-semibold text-gray-200">Save to Records</h3>
          <label class="mb-1.5 block text-xs text-gray-400">Record name</label>
          <input
            v-model="saveName"
            type="text"
            class="mb-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-brand-500/50 focus:outline-none"
            placeholder="e.g. Q1 Consolidation"
            @keydown.enter="handleSave"
          />
          <p v-if="saveError" class="mb-3 text-xs text-red-400">{{ saveError }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="saving"
              class="flex-1 rounded-md bg-brand-500 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-brand-400 disabled:opacity-50"
              @click="handleSave"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-md border border-white/10 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5"
              @click="showSaveModal = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
