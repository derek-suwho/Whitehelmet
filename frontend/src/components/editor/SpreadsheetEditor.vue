<script setup lang="ts">
// Only additions vs original:
//  1. activeTab ref + tab-switching logic
//  2. DataMap composable / inline map state
// Everything else is identical — do not remove existing imports/logic.
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useRecordsStore } from '@/stores/records'
import {
  useSpreadsheetEditor,
  sheetNames, currentSheetIdx, zoomLevel,
  formulaRef, formulaValue, fmtState, lastTextColor, lastFillColor,
} from '@/composables/useSpreadsheetEditor'

const spreadsheet = useSpreadsheetStore()
const records     = useRecordsStore()

const {
  openFile, closeFile, switchSheet, stepZoom, toolbarAction,
  setNumFormat, handleFormulaEnter, handleFormulaEscape,
  showColorPicker, downloadXlsx,
  wireKeyboardShortcuts, cleanupKeyboardShortcuts,
} = useSpreadsheetEditor()

// ── Tab state ────────────────────────────────────────────────
const activeTab = ref<'sheet' | 'map'>('sheet')

// ── Data Map state ───────────────────────────────────────────
const mapCanvas  = ref<HTMLElement | null>(null)
const mapSvg     = ref<SVGElement | null>(null)
let mapTx = 60, mapTy = 60, mapScale = 1
let isPanning = false, panStartX = 0, panStartY = 0

function applyMapTransform() {
  if (mapCanvas.value)
    mapCanvas.value.style.transform = `translate(${mapTx}px,${mapTy}px) scale(${mapScale})`
  if (zoomLabel.value)
    zoomLabel.value = Math.round(mapScale * 100) + '%'
}

const zoomLabel = ref('100%')

function onMapMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.map-node,.map-legend')) return
  isPanning = true; panStartX = e.clientX - mapTx; panStartY = e.clientY - mapTy
}
function onMapMouseMove(e: MouseEvent) {
  if (!isPanning) return
  mapTx = e.clientX - panStartX; mapTy = e.clientY - panStartY
  applyMapTransform(); drawMapLines()
}
function onMapMouseUp() { isPanning = false }

function onMapWheel(e: WheelEvent) {
  e.preventDefault()
  const d = e.deltaY > 0 ? 0.9 : 1.1
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mx = e.clientX - rect.left, my = e.clientY - rect.top
  mapTx = mx - (mx - mapTx) * d; mapTy = my - (my - mapTy) * d
  mapScale = Math.min(3, Math.max(0.2, mapScale * d))
  applyMapTransform(); drawMapLines()
}

function drawMapLines() {
  const svg    = mapSvg.value
  const canvas = mapCanvas.value
  if (!svg || !canvas) return
  svg.innerHTML = ''
  const connections = [
    ['node-s1','node-t1'],['node-s2','node-t1'],
    ['node-s3','node-t2'],['node-s4','node-t2'],
    ['node-s3','node-t3'],['node-s4','node-t3'],
    ['node-t1','node-o1'],['node-t2','node-o1'],
    ['node-t3','node-o2'],
  ]
  const cr = canvas.getBoundingClientRect()
  connections.forEach(([fId, tId]) => {
    const from = canvas.querySelector(`#${fId}`) as HTMLElement
    const to   = canvas.querySelector(`#${tId}`) as HTMLElement
    if (!from || !to) return
    const fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect()
    const fx = fr.right - cr.left, fy = fr.top - cr.top + fr.height / 2
    const tx = tr.left  - cr.left, ty = tr.top  - cr.top + tr.height / 2
    const cx = (fx + tx) / 2
    const path = document.createElementNS('http://www.w3.org/2000/svg','path')
    path.setAttribute('d',`M${fx},${fy} C${cx},${fy} ${cx},${ty} ${tx},${ty}`)
    path.setAttribute('fill','none'); path.setAttribute('stroke','#D1D5DB'); path.setAttribute('stroke-width','1.5')
    svg.appendChild(path)
  })
}

watch(activeTab, async (tab) => {
  if (tab === 'map') { await nextTick(); applyMapTransform(); drawMapLines() }
})

// ── Save modal ───────────────────────────────────────────────
const showSaveModal = ref(false)
const saveName      = ref('')
const saving        = ref(false)
const saveError     = ref('')
const zoomPercent   = computed(() => Math.round(zoomLevel.value * 100) + '%')

watch(() => spreadsheet.workbook, async (wb) => {
  if (!wb) return; await nextTick(); openFile(wb)
})
onMounted(() => { wireKeyboardShortcuts(); if (spreadsheet.workbook) openFile(spreadsheet.workbook) })
onBeforeUnmount(() => cleanupKeyboardShortcuts())

function handleDownload() { downloadXlsx(spreadsheet.fileName ?? 'spreadsheet.xlsx') }
function handleClose()    { showSaveModal.value = false; spreadsheet.clearPendingSave(); closeFile() }
function openSaveModal()  { saveName.value = spreadsheet.fileName?.replace(/\.xlsx$/i,'') ?? 'Consolidated'; saveError.value = ''; showSaveModal.value = true }

async function handleSave() {
  if (!saveName.value.trim()) { saveError.value = 'Name is required.'; return }
  saving.value = true; saveError.value = ''
  try {
    const data = spreadsheet.pendingSave
    if (!data) throw new Error('No data to save.')
    await records.createRecord({ name: saveName.value.trim(), headers: data.headers, rows: data.rows })
    showSaveModal.value = false; spreadsheet.clearPendingSave()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err)
  } finally { saving.value = false }
}

function onColorBtn(e: MouseEvent, type: 'text' | 'fill') {
  showColorPicker(e.currentTarget as HTMLElement, type)
}
</script>

<template>
  <main class="flex flex-1 flex-col overflow-hidden bg-surface-light" aria-label="Spreadsheet editor">

    <!-- ── Tab bar + toolbar row ── -->
    <div class="flex items-center gap-0 border-b border-border bg-white px-4" style="height:44px;">

      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm text-gray-400">
        <span>Home</span>
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" stroke-width="2"/></svg>
        <span class="font-medium text-gray-700">Records</span>
      </div>

      <!-- Tab group -->
      <div class="ml-6 flex items-center gap-0.5">
        <button
          v-for="tab in [{ id: 'sheet', label: 'Sheet View' }, { id: 'map', label: 'Data Map' }]"
          :key="tab.id"
          type="button"
          class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors"
          :class="activeTab === tab.id
            ? 'bg-brand-600 text-white'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'"
          @click="activeTab = (tab.id as 'sheet' | 'map')"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Download / Close (when file open) -->
      <template v-if="spreadsheet.fileName">
        <button type="button" class="rounded-md px-2.5 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" @click="handleDownload">Download</button>
        <button type="button" class="rounded-md px-2.5 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500" @click="handleClose">Close</button>
      </template>

      <!-- Add Column (sheet view) -->
      <button
        v-if="activeTab === 'sheet'"
        type="button"
        class="ml-2 flex items-center gap-1.5 rounded-full border border-brand-600 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        @click="toolbarAction('insert-col')"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Column
      </button>
    </div>

    <!-- ── Excel toolbar (sheet view only, when file open) ── -->
    <div
      v-if="spreadsheet.fileName && activeTab === 'sheet'"
      class="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1"
    >
      <span class="mr-2 flex items-center gap-1.5 text-xs text-gray-500">
        <svg class="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd"/></svg>
        {{ spreadsheet.fileName }}
      </span>
      <div class="xt-sep" />
      <button type="button" class="xt-btn" title="Undo (Ctrl+Z)" @click="toolbarAction('undo')"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button>
      <button type="button" class="xt-btn" title="Redo (Ctrl+Y)"  @click="toolbarAction('redo')"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/></svg></button>
      <div class="xt-sep" />
      <button type="button" :class="['xt-btn font-bold', fmtState.bold && 'xt-btn-active']"      title="Bold (Ctrl+B)"      @click="toolbarAction('bold')">B</button>
      <button type="button" :class="['xt-btn italic',    fmtState.italic && 'xt-btn-active']"    title="Italic (Ctrl+I)"    @click="toolbarAction('italic')">I</button>
      <button type="button" :class="['xt-btn underline', fmtState.underline && 'xt-btn-active']" title="Underline (Ctrl+U)" @click="toolbarAction('underline')">U</button>
      <div class="xt-sep" />
      <button type="button" class="xt-btn xt-color-btn" title="Text color" @click="onColorBtn($event,'text')"><span class="text-xs leading-none">A</span><span class="xt-color-bar" :style="{backgroundColor: lastTextColor}"/></button>
      <button type="button" class="xt-btn xt-color-btn" title="Fill color"  @click="onColorBtn($event,'fill')"><svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg><span class="xt-color-bar" :style="{backgroundColor: lastFillColor}"/></button>
      <div class="xt-sep" />
      <button type="button" :class="['xt-btn', fmtState.align==='left'   && 'xt-btn-active']" @click="toolbarAction('align-left')"><svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm0 5a1 1 0 011-1h8a1 1 0 110 2H3a1 1 0 01-1-1zm0 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg></button>
      <button type="button" :class="['xt-btn', fmtState.align==='center' && 'xt-btn-active']" @click="toolbarAction('align-center')"><svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm3 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-3 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg></button>
      <button type="button" :class="['xt-btn', fmtState.align==='right'  && 'xt-btn-active']" @click="toolbarAction('align-right')"><svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm5 5a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1zm-5 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clip-rule="evenodd"/></svg></button>
      <div class="xt-sep" />
      <button type="button" class="xt-btn text-[10px]" @click="toolbarAction('merge')">Merge</button>
      <button type="button" :class="['xt-btn', fmtState.wrapText && 'xt-btn-active']" @click="toolbarAction('wrap')"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h12a4 4 0 010 8H8m0 0l3-3m-3 3l3 3"/></svg></button>
      <div class="xt-sep" />
      <select class="xt-select" :value="fmtState.numFormat" @change="setNumFormat(($event.target as HTMLSelectElement).value)">
        <option value="">Default</option><option value="number">Number</option><option value="currency">Currency</option><option value="percent">Percent</option><option value="date">Date</option>
      </select>
      <div class="xt-sep" />
      <button type="button" class="xt-btn text-[10px]" @click="toolbarAction('insert-row')">+Row</button>
      <button type="button" class="xt-btn text-[10px]" @click="toolbarAction('insert-col')">+Col</button>
      <button type="button" class="xt-btn text-[10px]" @click="toolbarAction('delete-row')">-Row</button>
      <button type="button" :class="['xt-btn text-[10px]', fmtState.freeze && 'xt-btn-active']" @click="toolbarAction('freeze')">Freeze</button>
      <div class="xt-sep" />
      <button type="button" class="xt-btn" @click="toolbarAction('find')"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></button>
      <div class="xt-sep" />
      <button type="button" class="xt-btn" @click="stepZoom(-0.1)">−</button>
      <span class="xt-zoom-label">{{ zoomPercent }}</span>
      <button type="button" class="xt-btn" @click="stepZoom(0.1)">+</button>
      <button type="button" class="xt-btn text-[10px]" @click="toolbarAction('zoom-reset')">Reset</button>
    </div>

    <!-- ── Formula bar ── -->
    <div v-if="spreadsheet.fileName && activeTab === 'sheet'" class="xt-formula-bar">
      <span class="xt-cell-ref">{{ formulaRef }}</span>
      <span class="xt-formula-sep" />
      <input id="xt-formula-input" class="xt-formula-input" :value="formulaValue" spellcheck="false"
        @input="formulaValue = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="handleFormulaEnter"
        @keydown.escape.prevent="handleFormulaEscape"
      />
    </div>

    <!-- ── Save banner ── -->
    <div v-if="spreadsheet.pendingSave" class="flex items-center gap-3 border-b border-brand-500/20 bg-brand-50 px-4 py-2">
      <svg class="h-4 w-4 shrink-0 text-brand-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
      <span class="flex-1 text-xs text-gray-600">Save this consolidation to master records?</span>
      <button type="button" class="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 transition-colors" @click="openSaveModal">Save</button>
      <button type="button" class="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="spreadsheet.clearPendingSave()">Dismiss</button>
    </div>

    <!-- ── SHEET VIEW ── -->
    <template v-if="activeTab === 'sheet'">
      <div v-if="spreadsheet.fileName" id="spreadsheet-container" class="flex-1 overflow-auto" />
      <div v-if="sheetNames.length > 1" class="xt-sheet-tabs">
        <button v-for="(name, idx) in sheetNames" :key="idx" type="button"
          :class="['xt-sheet-tab', idx === currentSheetIdx && 'active']" @click="switchSheet(idx)">
          {{ name }}
        </button>
      </div>
      <div v-if="!spreadsheet.fileName" class="flex flex-1 flex-col items-center justify-center">
        <div class="text-center">
          <svg class="mx-auto mb-4 h-14 w-14 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m1.125-2.625c-.621 0-1.125.504-1.125 1.125"/></svg>
          <h3 class="text-lg font-semibold text-gray-400">No spreadsheet open</h3>
          <p class="mt-2 text-sm text-gray-400">Upload and consolidate files from the<br/>Sources panel to get started.</p>
        </div>
      </div>
    </template>

    <!-- ── DATA MAP VIEW ── -->
    <div
      v-if="activeTab === 'map'"
      class="relative flex-1 cursor-grab overflow-hidden"
      style="background-image: radial-gradient(circle, #D1D5DB 1px, transparent 1px); background-size: 24px 24px; background-color: #F8F9FA;"
      @mousedown="onMapMouseDown"
      @mousemove="onMapMouseMove"
      @mouseup="onMapMouseUp"
      @wheel.prevent="onMapWheel"
    >
      <!-- Canvas -->
      <div ref="mapCanvas" class="absolute" style="transform-origin: 0 0;">
        <svg ref="mapSvg" class="pointer-events-none absolute inset-0 overflow-visible" style="width:100%;height:100%;" />

        <!-- Sources -->
        <div class="absolute" style="left:0;top:40px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;">
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Sources</div>
          <div id="node-s1" class="map-node" style="background:#F5F3FF;border-color:#C4B5FD;color:#5B21B6;"><span class="map-dot" style="background:#8B5CF6;"></span>Q1_Report.xlsx</div>
          <div id="node-s2" class="map-node" style="background:#F5F3FF;border-color:#C4B5FD;color:#5B21B6;"><span class="map-dot" style="background:#8B5CF6;"></span>Q2_Report.xlsx</div>
          <div id="node-s3" class="map-node" style="background:#F5F3FF;border-color:#C4B5FD;color:#5B21B6;"><span class="map-dot" style="background:#8B5CF6;"></span>Budget_2025.csv</div>
          <div id="node-s4" class="map-node" style="background:#F5F3FF;border-color:#C4B5FD;color:#5B21B6;"><span class="map-dot" style="background:#8B5CF6;"></span>Actuals_Mar.xlsx</div>
        </div>

        <!-- Transform -->
        <div class="absolute" style="left:240px;top:40px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;">
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Transform</div>
          <div id="node-t1" class="map-node" style="background:#EFF6FF;border-color:#BFDBFE;color:#1E40AF;">Merge Sheets</div>
          <div id="node-t2" class="map-node" style="background:#EFF6FF;border-color:#BFDBFE;color:#1E40AF;">Filter Nulls</div>
          <div id="node-t3" class="map-node" style="background:#EFF6FF;border-color:#BFDBFE;color:#1E40AF;">Aggregate</div>
        </div>

        <!-- Output -->
        <div class="absolute" style="left:480px;top:40px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;">
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Output</div>
          <div id="node-o1" class="map-node" style="background:#ECFDF5;border-color:#6EE7B7;color:#065F46;"><span class="map-dot" style="background:#10B981;"></span>Consolidated_2025</div>
          <div id="node-o2" class="map-node" style="background:#ECFDF5;border-color:#6EE7B7;color:#065F46;"><span class="map-dot" style="background:#10B981;"></span>Budget_Summary</div>
        </div>

        <!-- Legend -->
        <div class="map-legend absolute" style="left:680px;top:0;">
          <div class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Legend</div>
          <div class="legend-item"><div class="legend-sw" style="background:#EDE9FE;border:1px solid #C4B5FD;"></div> Source file</div>
          <div class="legend-item"><div class="legend-sw" style="background:#EFF6FF;border:1px solid #BFDBFE;"></div> Transform step</div>
          <div class="legend-item"><div class="legend-sw" style="background:#ECFDF5;border:1px solid #6EE7B7;"></div> Output sheet</div>
        </div>
      </div>

      <!-- Zoom controls -->
      <div class="absolute bottom-5 right-5 flex flex-col gap-1">
        <button type="button" class="map-zoom-btn" @click="mapScale=Math.min(3,mapScale*1.2);applyMapTransform();drawMapLines()">+</button>
        <div class="map-zoom-label">{{ zoomLabel }}</div>
        <button type="button" class="map-zoom-btn" @click="mapScale=Math.max(0.2,mapScale/1.2);applyMapTransform();drawMapLines()">−</button>
        <button type="button" class="map-zoom-btn text-[11px]" title="Reset" @click="mapTx=60;mapTy=60;mapScale=1;applyMapTransform();drawMapLines()">⌂</button>
      </div>
    </div>

    <!-- ── Save modal ── -->
    <Teleport to="body">
      <div v-if="showSaveModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showSaveModal=false">
        <div class="w-80 rounded-xl border border-border bg-white p-6 shadow-2xl">
          <h3 class="mb-4 text-base font-semibold text-gray-800">Save to Records</h3>
          <label class="mb-1.5 block text-xs text-gray-500">Record name</label>
          <input v-model="saveName" type="text" class="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-none" placeholder="e.g. Q1 Consolidation" @keydown.enter="handleSave" />
          <p v-if="saveError" class="mb-3 text-xs text-red-500">{{ saveError }}</p>
          <div class="flex gap-2">
            <button type="button" :disabled="saving" class="flex-1 rounded-full bg-brand-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50" @click="handleSave">{{ saving ? 'Saving…' : 'Save' }}</button>
            <button type="button" class="flex-1 rounded-full border border-border py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50" @click="showSaveModal=false">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.map-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1.5px solid #E5E7EB;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: default;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.map-node:hover { border-color: #4338CA; box-shadow: 0 2px 10px rgba(67,56,202,0.15); }
.map-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.map-legend { background: white; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; }
.legend-item { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #6B7280; margin-top: 6px; }
.legend-sw { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.map-zoom-btn { width: 32px; height: 32px; background: white; border: 1px solid #E5E7EB; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #374151; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.map-zoom-btn:hover { background: #F9FAFB; }
.map-zoom-label { background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 4px 6px; font-size: 11px; font-weight: 500; color: #6B7280; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
</style>
