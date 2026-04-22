import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { MasterRecord } from '@/types'

export const useRecordsStore = defineStore('records', () => {
  const records = ref<MasterRecord[]>([])
  const loading = ref(false)

  async function fetchRecords() {
    loading.value = true
    try {
      const resp = await api.get<{ records: MasterRecord[]; total: number }>('/api/records')
      records.value = resp.records
    } catch (err) {
      console.error('[records] fetch failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createRecord(data: {
    name: string
    headers: string[]
    rows: unknown[][]
  }): Promise<MasterRecord> {
    const resp = await api.post<MasterRecord>('/api/records', data)
    records.value.unshift(resp)
    return resp
  }

  async function deleteRecord(id: number) {
    await api.delete(`/api/records/${id}`)
    records.value = records.value.filter((r) => r.id !== id)
  }

  return { records, loading, fetchRecords, createRecord, deleteRecord }
})
