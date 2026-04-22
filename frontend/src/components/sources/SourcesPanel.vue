<script setup lang="ts">
import { ref } from 'vue'
import { useSourcesStore } from '@/stores/sources'
import { useConsolidation } from '@/composables/useConsolidation'
import type { Source } from '@/types'

const sources = useSourcesStore()
const { consolidate, isConsolidating } = useConsolidation()

const isDragOver = ref(false)
const expandedFolders = ref<Set<string>>(new Set())

const fileInput = ref<HTMLInputElement | null>(null)

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  if (e.dataTransfer?.files) {
    sources.addFiles(e.dataTransfer.files)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    sources.addFiles(input.files)
    input.value = ''
  }
}

function toggleFolder(id: string) {
  const next = new Set(expandedFolders.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedFolders.value = next
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isChecked(id: string): boolean {
  return sources.checkedIds.has(id)
}
</script>

<template>
  <aside
    class="flex w-[280px] shrink-0 flex-col border-r border-white/5 bg-surface"
    aria-label="Source files"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 px-4 py-3">
      <h2 class="font-display text-sm font-semibold tracking-wide text-gray-200">Sources</h2>
      <span class="rounded-full bg-brand-600/15 px-2 py-0.5 text-xs font-medium text-brand-400">
        {{ sources.sources.length }}
      </span>
    </div>

    <!-- Drop zone -->
    <div class="p-3">
      <button
        type="button"
        class="w-full rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        :class="
          isDragOver
            ? 'border-brand-400 bg-brand-400/5 text-brand-300'
            : 'border-white/10 text-gray-500 hover:border-brand-500/40 hover:text-gray-400'
        "
        aria-label="Upload xlsx files"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @click="triggerFileInput"
      >
        <svg
          class="mx-auto mb-2 h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          />
        </svg>
        <span class="text-sm">Drop .xlsx files or click</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,.xls"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <ul
        v-if="sources.sources.length > 0"
        role="list"
        class="space-y-0.5"
      >
        <template
          v-for="source in sources.sources"
          :key="source.id"
        >
          <!-- Folder -->
          <li v-if="source.type === 'folder'">
            <div
              class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-white/5"
            >
              <input
                :id="`check-${source.id}`"
                type="checkbox"
                :checked="isChecked(source.id)"
                class="h-3.5 w-3.5 rounded border-gray-600 bg-transparent text-brand-500 accent-brand-500 focus:ring-brand-400 focus:ring-offset-0"
                :aria-label="`Select ${source.name}`"
                @change="sources.toggleCheck(source.id)"
              />
              <button
                type="button"
                class="flex flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
                :aria-expanded="expandedFolders.has(source.id)"
                :aria-label="`Toggle ${source.name} folder`"
                @click="toggleFolder(source.id)"
              >
                <svg
                  class="h-3.5 w-3.5 text-gray-500 transition-transform duration-200"
                  :class="expandedFolders.has(source.id) ? 'rotate-90' : ''"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg
                  class="h-4 w-4 text-brand-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    d="M3.75 3A1.75 1.75 0 002 4.75v3.5h16v-1.764a1.75 1.75 0 00-1.75-1.736H9.586a.25.25 0 01-.177-.073L7.88 3.148A1.75 1.75 0 006.645 2.5H3.75z"
                  />
                  <path
                    d="M2 9.75v5.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-5.5H2z"
                  />
                </svg>
                <span class="truncate text-sm text-gray-300">{{ source.name }}</span>
              </button>
              <button
                type="button"
                class="rounded p-0.5 text-gray-600 transition-colors duration-150 hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 active:text-red-300"
                :aria-label="`Delete ${source.name}`"
                @click="sources.removeSource(source.id)"
              >
                <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <!-- Folder children -->
            <ul
              v-if="expandedFolders.has(source.id) && source.children"
              role="list"
              class="ml-5 space-y-0.5"
            >
              <li
                v-for="child in source.children"
                :key="child.id"
              >
                <SourceFileRow
                  :source="child"
                  :is-checked="isChecked(child.id)"
                  @toggle="sources.toggleCheck(child.id)"
                  @remove="sources.removeSource(child.id)"
                />
              </li>
            </ul>
          </li>

          <!-- File -->
          <li v-else>
            <div
              class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-white/5"
            >
              <input
                :id="`check-${source.id}`"
                type="checkbox"
                :checked="isChecked(source.id)"
                class="h-3.5 w-3.5 rounded border-gray-600 bg-transparent text-brand-500 accent-brand-500 focus:ring-brand-400 focus:ring-offset-0"
                :aria-label="`Select ${source.name}`"
                @change="sources.toggleCheck(source.id)"
              />
              <svg
                class="h-4 w-4 shrink-0 text-green-500/70"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z"
                  clip-rule="evenodd"
                />
              </svg>
              <div class="flex flex-1 flex-col overflow-hidden">
                <span class="truncate text-sm text-gray-300">{{ source.name }}</span>
                <span class="text-xs text-gray-600">{{ formatSize(source.size) }}</span>
              </div>
              <button
                type="button"
                class="rounded p-0.5 text-gray-600 transition-colors duration-150 hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 active:text-red-300"
                :aria-label="`Delete ${source.name}`"
                @click="sources.removeSource(source.id)"
              >
                <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </li>
        </template>
      </ul>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <svg
          class="mb-3 h-10 w-10 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p class="text-sm text-gray-500">No files uploaded</p>
        <p class="mt-1 text-xs text-gray-600">Drop .xlsx files above</p>
      </div>
    </div>

    <!-- Consolidate button -->
    <div class="border-t border-white/5 p-3">
      <button
        type="button"
        :disabled="sources.checkedCount < 2 || isConsolidating"
        class="w-full rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        :class="
          sources.checkedCount >= 2 && !isConsolidating
            ? 'bg-brand-500 text-surface shadow-lg shadow-brand-500/20 hover:bg-brand-400 active:bg-brand-600'
            : 'cursor-not-allowed bg-white/5 text-gray-600'
        "
        @click="consolidate"
      >
        <template v-if="isConsolidating">
          <svg
            class="mr-2 inline-block h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Consolidating...
        </template>
        <template v-else>
          Consolidate ({{ sources.checkedCount }})
        </template>
      </button>
    </div>
  </aside>
</template>
