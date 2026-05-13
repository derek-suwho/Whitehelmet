<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { supabase } from '@/lib/supabase'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useTemplatesStore } from '@/stores/templates'
import { useFormulasStore } from '@/stores/formulas'
import { getColumnHeadersExternal, detectHeaderRow } from '@/composables/useSpreadsheetEditor'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const templatesStore = useTemplatesStore()
const formulasStore = useFormulasStore()

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

const sheetId = route.params.sheetId as string
const templateId = route.query.template_id as string | undefined
const projectId = route.query.project_id as string | undefined
const submissionIdsParam = route.query.submission_ids as string | undefined
const includedSubmissionIds = submissionIdsParam ? new Set(submissionIdsParam.split(',')) : null

interface OrgStatus {
  org_id: string
  org_name: string
  submission_id: string | null
  file_name: string | null
}

const subcontractors = ref<OrgStatus[]>([])
const loadError = ref('')

// ── Apply Formula dialog ─────────────────────────────────────────────────────
const showFormulaApply = ref(false)
const selectedFormulaId = ref('')
const paramColumnMap = ref<Record<string, string>>({})
const outputName = ref('')
const sheetColumns = ref<{ idx: number; letter: string; name: string }[]>([])
const applyLoading = ref(false)
const applyError = ref('')
const applySuccess = ref('')

const selectedFormula = computed(() =>
  formulasStore.formulas.find(f => String(f.id) === selectedFormulaId.value) ?? null
)

function openFormulaApply() {
  sheetColumns.value = getColumnHeadersExternal()
  selectedFormulaId.value = ''
  paramColumnMap.value = {}
  outputName.value = ''
  applyError.value = ''
  applySuccess.value = ''
  showFormulaApply.value = true
  if (!formulasStore.formulas.length) formulasStore.fetchFormulas()
}

function onFormulaSelect() {
  paramColumnMap.value = {}
  outputName.value = selectedFormula.value?.name ?? ''
}

async function applyFormula() {
  if (!selectedFormulaId.value) { applyError.value = 'Select a formula.'; return }
  if (!outputName.value.trim()) { applyError.value = 'Enter an output column name.'; return }

  const params = selectedFormula.value?.parameters ?? []
  for (const p of params) {
    if (!paramColumnMap.value[p]) {
      applyError.value = `Map all parameters — "${p}" is not mapped.`
      return
    }
  }

  const hot = spreadsheetStore.instance
  if (!hot) { applyError.value = 'Spreadsheet not loaded yet.'; return }

  const allData = hot.getData() as unknown[][]
  if (allData.length < 2) { applyError.value = 'No data rows in the sheet.'; return }

  const headerRowIdx = detectHeaderRow(allData)
  const headers = (allData[headerRowIdx] as unknown[]).map(h => String(h ?? ''))
  const dataRows = allData.slice(headerRowIdx + 1).map(row => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { if (h.trim()) obj[h] = (row as unknown[])[i] })
    return obj
  })

  applyLoading.value = true
  applyError.value = ''
  applySuccess.value = ''
  try {
    const result = await api.post<{ column_name: string; values: (number | null)[] }>(
      '/api/formulas/evaluate',
      {
        formula_id: selectedFormulaId.value,
        column_map: paramColumnMap.value,
        output_name: outputName.value.trim(),
        rows: dataRows,
      },
    )

    // Append new column after the last existing column
    const newColIdx = hot.countCols()
    const changes: [number, number, unknown][] = [[headerRowIdx, newColIdx, result.column_name]]
    result.values.forEach((val, rowIdx) => {
      changes.push([headerRowIdx + 1 + rowIdx, newColIdx, val ?? ''])
    })
    hot.setDataAtCell(changes)
    applySuccess.value = `Column "${result.column_name}" added with ${result.values.length} values.`
    selectedFormulaId.value = ''
    paramColumnMap.value = {}
  } catch (e) {
    applyError.value = e instanceof Error ? e.message : 'Failed to apply formula'
  } finally {
    applyLoading.value = false
  }
}
// ─────────────────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/templates/consolidations/${sheetId}/download`, { headers })
    if (!resp.ok) throw new Error('Failed to load consolidated sheet')
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true })
    spreadsheetStore.loadWorkbook(wb, 'master.xlsx', buffer)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load sheet'
  }

  if (templateId) {
    try {
      const url = projectId
        ? `/api/admin/templates/${templateId}/consolidation-progress?project_id=${projectId}`
        : `/api/admin/templates/${templateId}/consolidation-progress`
      const data = await api.get<{ orgs: OrgStatus[] }>(url)
      const submitted = data.orgs.filter(o => o.submission_id !== null)
      const filtered = includedSubmissionIds
        ? submitted.filter(o => o.submission_id && includedSubmissionIds.has(o.submission_id))
        : submitted
      const seen = new Set<string>()
      subcontractors.value = filtered.filter(o => {
        if (seen.has(o.org_id)) return false
        seen.add(o.org_id)
        return true
      })
    } catch { /* non-fatal */ }
  }

  if (templateId) templatesStore.fetchTemplate(templateId)
})

async function reloadAfterFinetune() {
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/templates/consolidations/${sheetId}/download`, { headers })
    if (!resp.ok) return
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true })
    spreadsheetStore.loadWorkbook(wb, 'master.xlsx', buffer)
  } catch { /* non-fatal */ }
}

function goBack() {
  if (templateId) {
    const query = projectId ? `?project_id=${projectId}` : ''
    router.push(`/admin/consolidations/${templateId}${query}`)
  } else {
    router.push('/admin/dashboard')
  }
}

function download() {
  window.open(`/api/templates/consolidations/${sheetId}/download`, '_blank')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm">
        <button class="text-gray-400 hover:text-gray-600 transition-colors" @click="goBack">
          ← Subcontractors
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-gray-800 font-semibold">
          Master Sheet{{ templatesStore.currentTemplate ? ` — ${templatesStore.currentTemplate.name}` : '' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="border border-violet-300 text-violet-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-50 transition-colors"
          @click="openFormulaApply"
        >
          ƒ Apply Formula
        </button>
        <button
          class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          @click="download"
        >
          Download xlsx
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <!-- Content -->
    <div v-else class="flex flex-1 min-h-0">
      <!-- Spreadsheet (main area) -->
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <SpreadsheetEditor class="flex-1" />
      </div>

      <!-- Right sidebar -->
      <div class="w-72 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
        <!-- Subcontractors section -->
        <div class="border-b border-gray-200 p-4 shrink-0">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Subcontractors
              <span class="text-gray-400 font-normal normal-case">({{ subcontractors.length }})</span>
            </span>
            <button
              class="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              @click="goBack"
            >
              + Add More
            </button>
          </div>
          <div v-if="subcontractors.length" class="space-y-1.5 max-h-40 overflow-y-auto">
            <div
              v-for="org in subcontractors"
              :key="org.org_id"
              class="flex items-center gap-2 text-sm text-gray-700"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
              {{ org.org_name }}
            </div>
          </div>
          <div v-else class="text-xs text-gray-400 italic">Loading…</div>
        </div>

        <!-- AI Fine-Tuning -->
        <div class="flex-1 min-h-0">
          <AIChatPanel
            mode="consolidation-finetune"
            :template-id="templateId ?? ''"
            :consolidated-sheet-id="sheetId"
            @finetune-applied="reloadAfterFinetune"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Apply Formula Modal -->
  <Teleport to="body">
    <div v-if="showFormulaApply" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showFormulaApply = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Apply Formula to Sheet</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg leading-none" @click="showFormulaApply = false">✕</button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Formula selector -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Formula *</label>
            <select
              v-model="selectedFormulaId"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              @change="onFormulaSelect"
            >
              <option value="">Select a formula…</option>
              <option v-for="f in formulasStore.formulas" :key="f.id" :value="String(f.id)">
                {{ f.name }}{{ f.parameters?.length ? ` (${f.parameters.join(', ')})` : '' }}
              </option>
            </select>
            <p v-if="selectedFormula" class="mt-1 text-xs text-gray-400 font-mono">{{ selectedFormula.expression }}</p>
          </div>

          <!-- Parameter → Column mappings -->
          <div v-if="selectedFormula?.parameters?.length">
            <label class="block text-xs font-medium text-gray-500 mb-2">Map Parameters to Columns</label>
            <div class="space-y-2">
              <div
                v-for="param in selectedFormula.parameters"
                :key="param"
                class="flex items-center gap-3"
              >
                <span class="w-32 shrink-0 rounded bg-violet-50 px-2 py-1 text-xs font-mono text-violet-700">{{ param }}</span>
                <span class="text-gray-400 text-sm">→</span>
                <select
                  v-model="paramColumnMap[param]"
                  class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select column…</option>
                  <option v-for="col in sheetColumns" :key="col.idx" :value="col.name">
                    {{ col.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div v-else-if="selectedFormula">
            <p class="text-xs text-gray-400 italic">This formula has no named parameters — it will be evaluated as a constant.</p>
          </div>

          <!-- Output column name -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Output Column Name *</label>
            <input
              v-model="outputName"
              placeholder="e.g. TRIR"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p class="text-xs text-gray-400 mt-1">A new column with this name will be added to the sheet.</p>
          </div>

          <!-- Error / success -->
          <p v-if="applyError" class="text-sm text-red-600">{{ applyError }}</p>
          <p v-if="applySuccess" class="text-sm text-green-600">{{ applySuccess }}</p>
        </div>

        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100" @click="showFormulaApply = false">Cancel</button>
          <button
            :disabled="applyLoading || !selectedFormulaId || !outputName.trim()"
            class="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            @click="applyFormula"
          >
            {{ applyLoading ? 'Applying…' : 'Apply Formula' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
