import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Source } from '@/types'

let nextId = 1
function uid(): string {
  return `src-${nextId++}-${Date.now().toString(36)}`
}

export const useSourcesStore = defineStore('sources', () => {
  const sources = ref<Source[]>([])
  const checkedIds = ref<Set<string>>(new Set())

  const checkedCount = computed(() => checkedIds.value.size)

  function _topLevelNames(): Set<string> {
    return new Set(sources.value.map((s) => s.name))
  }

  function addFiles(files: FileList) {
    const existing = _topLevelNames()
    for (const file of Array.from(files)) {
      if (existing.has(file.name)) continue
      existing.add(file.name)
      sources.value.push({
        id: uid(),
        name: file.name,
        size: file.size,
        file,
        type: 'file',
      })
    }
  }

  function addFolder(files: FileList) {
    if (files.length === 0) return

    const xlsxFiles = Array.from(files).filter((f) =>
      /\.(xlsx|xls)$/i.test(f.name),
    )
    if (xlsxFiles.length === 0) return

    const first = files[0]
    const parts = (first as any).webkitRelativePath?.split('/') ?? []
    const folderName = parts[0] || 'Folder'

    if (_topLevelNames().has(folderName)) return

    const folderId = uid()
    const children: Source[] = xlsxFiles.map((file) => ({
      id: uid(),
      name: file.name,
      size: file.size,
      file,
      type: 'file' as const,
    }))

    sources.value.push({
      id: folderId,
      name: folderName,
      size: children.reduce((sum, c) => sum + c.size, 0),
      file: xlsxFiles[0],
      type: 'folder',
      children,
    })
  }

  function addFolderFromDrop(folderName: string, files: File[]) {
    if (files.length === 0) return
    if (_topLevelNames().has(folderName)) return

    const folderId = uid()
    const children: Source[] = files.map((file) => ({
      id: uid(),
      name: file.name,
      size: file.size,
      file,
      type: 'file' as const,
    }))
    sources.value.push({
      id: folderId,
      name: folderName,
      size: children.reduce((sum, c) => sum + c.size, 0),
      file: files[0],
      type: 'folder',
      children,
    })
  }

  function removeSource(id: string) {
    const idx = sources.value.findIndex((s) => s.id === id)
    if (idx === -1) return

    const source = sources.value[idx]

    // Remove from checked set
    checkedIds.value.delete(id)
    if (source.children) {
      for (const child of source.children) {
        checkedIds.value.delete(child.id)
      }
    }

    // Trigger reactivity on Set
    checkedIds.value = new Set(checkedIds.value)

    sources.value.splice(idx, 1)
  }

  function toggleCheck(id: string) {
    const next = new Set(checkedIds.value)

    if (next.has(id)) {
      next.delete(id)
      // If folder, uncheck children
      const source = findSource(id)
      if (source?.children) {
        for (const child of source.children) {
          next.delete(child.id)
        }
      }
    } else {
      next.add(id)
      // If folder, check all children
      const source = findSource(id)
      if (source?.children) {
        for (const child of source.children) {
          next.add(child.id)
        }
      }
    }

    checkedIds.value = next
  }

  function findSource(id: string): Source | undefined {
    for (const s of sources.value) {
      if (s.id === id) return s
      if (s.children) {
        const child = s.children.find((c) => c.id === id)
        if (child) return child
      }
    }
    return undefined
  }

  function getCheckedFiles(): File[] {
    const files: File[] = []
    for (const s of sources.value) {
      if (s.type === 'file' && checkedIds.value.has(s.id)) {
        files.push(s.file)
      }
      if (s.children) {
        for (const child of s.children) {
          if (checkedIds.value.has(child.id)) {
            files.push(child.file)
          }
        }
      }
    }
    return files
  }

  return {
    sources,
    checkedIds,
    checkedCount,
    addFiles,
    addFolder,
    addFolderFromDrop,
    removeSource,
    toggleCheck,
    getCheckedFiles,
  }
})
