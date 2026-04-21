import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useSpreadsheetStore = defineStore('spreadsheet', () => {
  const instance = shallowRef<any>(null) // Jspreadsheet CE instance
  const workbook = shallowRef<any>(null) // SheetJS workbook
  const fileName = ref<string | null>(null)

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
  }

  function loadWorkbook(wb: any, name: string) {
    if (instance.value?.destroy) {
      instance.value.destroy()
    }
    instance.value = null
    fileName.value = name
    workbook.value = wb
  }

  return { instance, workbook, fileName, setInstance, clear, loadWorkbook }
})
