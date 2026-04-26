<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import { useAdminStore } from '@/stores/admin'
import ColumnEditor from '@/components/template/ColumnEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'
import VersionHistoryTable from '@/components/template/VersionHistoryTable.vue'
import AssignmentModal from './modals/AssignmentModal.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import type { SchemaColumn, SchemaJson } from '@/types/database'

const route = useRoute()
const router = useRouter()
const templatesStore = useTemplatesStore()
const adminStore = useAdminStore()

const templateId = computed(() => route.params.id as string | undefined)
const isNew = computed(() => !templateId.value)
const openWithAI = computed(() => route.query.ai === 'true')

const activeTab = ref<'columns' | 'formulas' | 'assignments'>('columns')
const showAIPanel = ref(openWithAI.value)
const showAssignmentModal = ref(false)
const saving = ref(false)
const saveError = ref('')
const templateName = ref('')
const columns = ref<SchemaColumn[]>([])

onMounted(async () => {
  if (templateId.value) {
    await templatesStore.fetchTemplate(templateId.value)
    templateName.value = templatesStore.currentTemplate?.name ?? ''
    const schema = templatesStore.currentVersion?.schema_json as unknown as SchemaJson | null
    columns.value = schema?.columns ?? []
  }
  adminStore.fetchOrganizations()
})

async function saveDraft() {
  saving.value = true
  saveError.value = ''
  try {
    if (isNew.value) {
      const t = await templatesStore.createTemplate(templateName.value || 'Untitled Template', '')
      await templatesStore.saveVersion(t.id, { columns: columns.value })
      router.replace(`/admin/templates/${t.id}/edit`)
    } else {
      await templatesStore.saveVersion(templateId.value!, { columns: columns.value })
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    saving.value = false
  }
}

async function publish() {
  saving.value = true
  saveError.value = ''
  try {
    if (isNew.value) {
      const t = await templatesStore.createTemplate(templateName.value || 'Untitled Template', '')
      await templatesStore.saveVersion(t.id, { columns: columns.value })
      await templatesStore.publishTemplate(t.id)
      router.replace(`/admin/templates/${t.id}/edit`)
    } else {
      await templatesStore.saveVersion(templateId.value!, { columns: columns.value })
      await templatesStore.publishTemplate(templateId.value!)
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Publish failed'
  } finally {
    saving.value = false
  }
}

function onSchemaGenerated(schema: object) {
  const s = schema as SchemaJson
  if (s.columns) {
    columns.value = s.columns
    showAIPanel.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- Header -->
    <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
      <RouterLink to="/admin/templates" class="text-gray-400 hover:text-gray-600 text-sm">← Templates</RouterLink>
      <input
        v-model="templateName"
        type="text"
        placeholder="Template name"
        class="flex-1 text-base font-medium border-0 outline-none focus:ring-0 bg-transparent"
      />
      <div class="flex items-center gap-2">
        <span v-if="saveError" class="text-xs text-red-600">{{ saveError }}</span>
        <button
          :disabled="saving"
          class="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          @click="saveDraft"
        >Save Draft</button>
        <button
          :disabled="saving"
          class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          @click="publish"
        >Publish</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 bg-white px-5">
      <button
        v-for="tab in ['columns', 'formulas', 'assignments'] as const"
        :key="tab"
        class="px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors"
        :class="activeTab === tab
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex">
      <!-- Columns tab -->
      <template v-if="activeTab === 'columns'">
        <div class="flex-1 overflow-hidden">
          <SpreadsheetEditor :model-value="null" />
        </div>
        <div class="w-80 shrink-0 border-l border-gray-200 flex flex-col overflow-y-auto">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span class="text-sm font-medium text-gray-700">Columns</span>
            <button
              class="text-xs text-blue-600 hover:underline"
              @click="showAIPanel = !showAIPanel"
            >{{ showAIPanel ? 'Hide AI' : 'Build with AI' }}</button>
          </div>
          <div v-if="showAIPanel" class="flex-1">
            <AIChatPanel
              mode="template-builder"
              :template-id="templateId"
              @schema-generated="onSchemaGenerated"
            />
          </div>
          <div v-else class="flex-1 p-3 overflow-y-auto">
            <ColumnEditor v-model="columns" />
          </div>
        </div>
      </template>

      <!-- Formulas tab -->
      <template v-if="activeTab === 'formulas'">
        <div class="flex-1 p-6 overflow-y-auto">
          <div class="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            Formula library panel (Group 3 component) will be embedded here once Group 3 delivers
            <code class="font-mono text-xs">@/components/formula/FormulaLibraryPanel.vue</code>.
          </div>
          <div class="mt-4 space-y-2">
            <div
              v-for="col in columns"
              :key="col.id"
              class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5"
            >
              <span class="text-sm font-medium text-gray-700">{{ col.name || '(unnamed)' }}</span>
              <span
                v-if="col.formula_id"
                class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
              >Formula attached</span>
              <span v-else class="text-xs text-gray-400">No formula</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Assignments tab -->
      <template v-if="activeTab === 'assignments'">
        <div class="flex-1 p-6 overflow-y-auto space-y-4">
          <div class="flex justify-between items-center">
            <h2 class="font-medium text-gray-700">Version History</h2>
          </div>
          <VersionHistoryTable :versions="templatesStore.versions" />

          <div class="flex justify-between items-center pt-4">
            <h2 class="font-medium text-gray-700">Assignments</h2>
            <button
              :disabled="!templatesStore.currentVersion"
              class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              @click="showAssignmentModal = true"
            >Assign to DevCos</button>
          </div>
          <div class="text-sm text-gray-400">Assignments are managed from the tracking view.</div>
        </div>
      </template>
    </div>
  </div>

  <AssignmentModal
    :open="showAssignmentModal"
    :template-version-id="templatesStore.currentVersion?.id ?? ''"
    @close="showAssignmentModal = false"
    @assigned="showAssignmentModal = false"
  />
</template>
