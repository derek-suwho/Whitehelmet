<script setup lang="ts">
import Handsontable from 'handsontable'
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { SchemaColumn } from '@/types/database'

const props = defineProps<{ columns: SchemaColumn[] }>()

const container = ref<HTMLElement | null>(null)
let hot: Handsontable | null = null

function buildGrid() {
  if (!container.value) return
  hot?.destroy()
  hot = null

  const cols = props.columns
  if (!cols.length) return

  hot = new Handsontable(container.value, {
    data: Array.from({ length: 30 }, () => Array(cols.length).fill('')),
    colHeaders: cols.map(c => c.name || '(unnamed)'),
    columns: cols.map(c => ({
      type: (c.type === 'number' || c.type === 'percentage') ? 'numeric' : 'text',
      readOnly: false,
    })),
    rowHeaders: true,
    width: '100%',
    height: '100%',
    licenseKey: 'non-commercial-and-evaluation',
    stretchH: 'all',
    contextMenu: false,
    dropdownMenu: false,
    filters: false,
    manualColumnResize: true,
    wordWrap: false,
  })
}

onMounted(async () => {
  await nextTick()
  buildGrid()
})

watch(
  () => props.columns,
  async () => {
    await nextTick()
    buildGrid()
  },
  { deep: true },
)

onBeforeUnmount(() => { hot?.destroy(); hot = null })
</script>

<template>
  <div class="relative flex flex-col w-full h-full">
    <!-- Empty state -->
    <div
      v-if="columns.length === 0"
      class="flex flex-col items-center justify-center flex-1 text-center"
    >
      <div class="text-4xl mb-3">📋</div>
      <p class="text-sm font-medium text-gray-600 mb-1">No columns yet</p>
      <p class="text-xs text-gray-400">Add columns in the panel on the right, or let AI generate them.</p>
    </div>
    <!-- Handsontable container — always in DOM so ref resolves immediately -->
    <div
      v-show="columns.length > 0"
      ref="container"
      class="flex-1 w-full overflow-hidden"
    />
  </div>
</template>
