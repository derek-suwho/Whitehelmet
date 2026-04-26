import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export interface PendingSave {
  headers: string[]
  rows: unknown[][]
}

export const useSpreadsheetStore = defineStore('spreadsheet', () => {
  const instance = shallowRef<any>(null)
  const workbook = shallowRef<any>(null)
  const fileName = ref<string | null>(null)
  const pendingSave = ref<PendingSave | null>(null)

  function setInstance(jss: any, wb: any, name: string) {
    instance.value = jss
    workbook.value = wb
    fileName.value = name
  }

  function clear() {
    if (instance.value?.destroy) {
      instance.value.destroy()
    }
    instance.value = null
    workbook.value = null
    fileName.value = null
    pendingSave.value = null
  }

  function loadWorkbook(wb: any, name: string) {
    if (instance.value?.destroy) {
      instance.value.destroy()
    }
    instance.value = null
    fileName.value = name
    workbook.value = wb
  }

  function setPendingSave(data: PendingSave) {
    pendingSave.value = data
  }

  function clearPendingSave() {
    pendingSave.value = null
  }

  return { instance, workbook, fileName, pendingSave, setInstance, clear, loadWorkbook, setPendingSave, clearPendingSave }
})
