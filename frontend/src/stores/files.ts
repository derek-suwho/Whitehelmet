import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { UserFile } from '@/types'

export const useFilesStore = defineStore('files', () => {
  const files = ref<UserFile[]>([])
  const loading = ref(false)

  async function fetchFiles() {
    loading.value = true
    try {
      const resp = await api.get<{ files: UserFile[]; total: number }>('/api/files')
      files.value = resp.files
    } catch (err) {
      console.error('[files] fetch failed:', err)
      files.value = []
    } finally {
      loading.value = false
    }
  }

  async function uploadFile(file: File) {
    const resp = await api.upload<UserFile>('/api/files/upload', file)
    files.value.unshift(resp)
    return resp
  }

  async function deleteFile(id: number) {
    await api.delete(`/api/files/${id}`)
    files.value = files.value.filter((f) => f.id !== id)
  }

  return { files, loading, fetchFiles, uploadFile, deleteFile }
})
