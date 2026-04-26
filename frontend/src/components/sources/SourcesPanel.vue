<script setup lang="ts">
// Script block is IDENTICAL to the original — no logic changes needed.
// Only the <template> / class names change.
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { useSourcesStore } from '@/stores/sources'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useConsolidation } from '@/composables/useConsolidation'
import type { Source } from '@/types'

const sources    = useSourcesStore()
const spreadsheet = useSpreadsheetStore()
const { consolidate, isConsolidating } = useConsolidation()

async function openFile(source: Source) {
  const buffer = await source.file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  spreadsheet.loadWorkbook(wb, source.file.name)
}

const isDragOver       = ref(false)
const expandedFolders  = ref<Set<string>>(new Set())
const fileInput        = ref<HTMLInputElement | null>(null)
const folderInput      = ref<HTMLInputElement | null>(null)

function handleDragOver(e: DragEvent)  { e.preventDefault(); isDragOver.value = true }
function handleDragLeave()              { isDragOver.value = false }

async function handleDrop(e: DragEvent) {
  e.preventDefault(); isDragOver.value = false
  if (!e.dataTransfer) return
  const items  = Array.from(e.dataTransfer.items)
  const dirItem = items.find(i => (i as any).webkitGetAsEntry?.()?.isDirectory)
  if (dirItem) {
    const entry = (dirItem as any).webkitGetAsEntry() as FileSystemDirectoryEntry
    const files = await readDirectoryFiles(entry)
    sources.addFolderFromDrop(entry.name, files)
  } else if (e.dataTransfer.files.length > 0) {
    sources.addFiles(e.dataTransfer.files)
  }
}

function readDirectoryFiles(dir: FileSystemDirectoryEntry): Promise<File[]> {
  return new Promise(resolve => {
    const reader = dir.createReader()
    const files: File[] = []
    function readBatch() {
      reader.readEntries(async entries => {
        if (!entries.length) { resolve(files); return }
        for (const entry of entries) {
          if (entry.isFile) {
            const fe = entry as FileSystemFileEntry
            if (/\.(xlsx|xls)$/i.test(fe.name)) {
              await new Promise<void>(res => fe.file(f => { files.push(f); res() }))
            }
          }
        }
        readBatch()
      })
    }
    readBatch()
  })
}

function triggerFileInput()   { fileInput.value?.click() }
function triggerFolderInput() { folderInput.value?.click() }

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) { sources.addFiles(input.files); input.value = '' }
}
function handleFolderSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) { sources.addFolder(input.files); input.value = '' }
}

function toggleFolder(id: string) {
  const next = new Set(expandedFolders.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedFolders.value = next
}

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isChecked(id: string) { return sources.checkedIds.has(id) }
</script>

<template>
  <!-- Light white sidebar -->
  <aside
    class="flex flex-col border-r border-border bg-surface-card"
    aria-label="Source files"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <span class="text-xs font-semibold uppercase tracking-widest text-gray-500">Sources</span>
      <span class="rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-semibold text-brand-600">
        {{ sources.sources.length }}
      </span>
    </div>

    <!-- Upload area -->
    <div class="p-3">
      <div
        class="rounded-lg border-2 border-dashed transition-colors duration-200"
        :class="isDragOver ? 'border-brand-600 bg-brand-50' : 'border-border hover:border-brand-300'"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <div class="flex gap-2 p-3">
          <!-- Files -->
          <button
            type="button"
            class="flex flex-1 flex-col items-center gap-1.5 rounded-md py-3 text-center text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Upload xlsx files"
            @click="triggerFileInput"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span class="text-xs font-medium">Files</span>
          </button>

          <div class="w-px self-stretch bg-border" />

          <!-- Folder -->
          <button
            type="button"
            class="flex flex-1 flex-col items-center gap-1.5 rounded-md py-3 text-center text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Upload folder"
            @click="triggerFolderInput"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              <line x1="12" y1="18" x2="12" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span class="text-xs font-medium">Folder</span>
          </button>
        </div>
        <p class="pb-2.5 text-center text-xs text-gray-400">or drag &amp; drop</p>
      </div>

      <input ref="fileInput"   type="file" accept=".xlsx,.xls" multiple  class="hidden" @change="handleFileSelect" />
      <input ref="folderInput" type="file" webkitdirectory              class="hidden" @change="handleFolderSelect" />
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <ul v-if="sources.sources.length > 0" role="list" class="space-y-0.5">
        <template v-for="source in sources.sources" :key="source.id">

          <!-- Folder -->
          <li v-if="source.type === 'folder'">
            <div class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50">
              <input
                :id="`check-${source.id}`" type="checkbox" :checked="isChecked(source.id)"
                class="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600"
                :aria-label="`Select ${source.name}`"
                @change="sources.toggleCheck(source.id)"
              />
              <button
                type="button"
                class="flex flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
                :aria-expanded="expandedFolders.has(source.id)"
                @click="toggleFolder(source.id)"
              >
                <svg
                  class="h-3.5 w-3.5 text-gray-400 transition-transform duration-200"
                  :class="expandedFolders.has(source.id) ? 'rotate-90' : ''"
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/>
                </svg>
                <svg class="h-4 w-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.75 3A1.75 1.75 0 002 4.75v3.5h16v-1.764a1.75 1.75 0 00-1.75-1.736H9.586a.25.25 0 01-.177-.073L7.88 3.148A1.75 1.75 0 006.645 2.5H3.75z"/>
                  <path d="M2 9.75v5.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-5.5H2z"/>
                </svg>
                <span class="truncate text-sm text-gray-700">{{ source.name }}</span>
                <span v-if="source.children" class="ml-auto shrink-0 text-xs text-gray-400">{{ source.children.length }}</span>
              </button>
              <button
                type="button" class="rounded p-0.5 text-gray-300 transition-colors hover:text-red-400"
                :aria-label="`Delete ${source.name}`" @click="sources.removeSource(source.id)"
              >
                <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
            <!-- Children -->
            <ul v-if="expandedFolders.has(source.id) && source.children" role="list" class="ml-5 space-y-0.5">
              <li v-for="child in source.children" :key="child.id">
                <div class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50">
                  <input :id="`check-${child.id}`" type="checkbox" :checked="isChecked(child.id)"
                    class="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600"
                    @change="sources.toggleCheck(child.id)" />
                  <button type="button" class="flex flex-1 items-center gap-2 overflow-hidden text-left focus-visible:outline-none" @click="openFile(child)">
                    <svg class="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex flex-1 flex-col overflow-hidden">
                      <span class="truncate text-sm text-gray-700">{{ child.name }}</span>
                      <span class="text-xs text-gray-400">{{ formatSize(child.size) }}</span>
                    </div>
                  </button>
                  <button type="button" class="rounded p-0.5 text-gray-300 transition-colors hover:text-red-400" @click="sources.removeSource(child.id)">
                    <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
                  </button>
                </div>
              </li>
            </ul>
          </li>

          <!-- File -->
          <li v-else>
            <div class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50">
              <input :id="`check-${source.id}`" type="checkbox" :checked="isChecked(source.id)"
                class="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600"
                @change="sources.toggleCheck(source.id)" />
              <button type="button" class="flex flex-1 items-center gap-2 overflow-hidden text-left focus-visible:outline-none" @click="openFile(source)">
                <svg class="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd"/>
                </svg>
                <div class="flex flex-1 flex-col overflow-hidden">
                  <span class="truncate text-sm text-gray-700">{{ source.name }}</span>
                  <span class="text-xs text-gray-400">{{ formatSize(source.size) }}</span>
                </div>
              </button>
              <button type="button" class="rounded p-0.5 text-gray-300 transition-colors hover:text-red-400" @click="sources.removeSource(source.id)">
                <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </li>

        </template>
      </ul>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-12 text-center">
        <svg class="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
        </svg>
        <p class="text-sm font-medium text-gray-500">No files uploaded</p>
        <p class="mt-1 text-xs text-gray-400">Drop files or a folder above</p>
      </div>
    </div>

    <!-- Consolidate footer -->
    <div class="border-t border-border p-3">
      <button
        type="button"
        :disabled="sources.checkedCount < 2 || isConsolidating"
        class="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
        :class="sources.checkedCount >= 2 && !isConsolidating
          ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800'
          : 'cursor-not-allowed bg-gray-100 text-gray-400'"
        @click="consolidate"
      >
        <svg v-if="isConsolidating" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
        <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
        {{ isConsolidating ? 'Consolidating…' : `Consolidate (${sources.checkedCount})` }}
      </button>
    </div>
  </aside>
</template>
