import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { SavedFormula, FormulaCreate } from '@/types'

export const useFormulasStore = defineStore('formulas', () => {
  const formulas = ref<SavedFormula[]>([])
  const libraryFormulas = ref<SavedFormula[]>([])
  const loading = ref(false)

  async function fetchFormulas() {
    loading.value = true
    try {
      const resp = await api.get<{ formulas: SavedFormula[]; total: number }>('/api/formulas')
      formulas.value = resp.formulas
    } catch (err) {
      console.error('[formulas] fetch failed:', err)
    } finally {
      loading.value = false
    }
  }

  async function saveFormula(payload: FormulaCreate): Promise<SavedFormula> {
    const resp = await api.post<SavedFormula>('/api/formulas', payload)
    formulas.value.unshift(resp)
    return resp
  }

  async function updateFormula(id: number, payload: FormulaCreate): Promise<SavedFormula> {
    const resp = await api.put<SavedFormula>(`/api/formulas/${id}`, payload)
    const idx = formulas.value.findIndex((f) => f.id === id)
    if (idx !== -1) formulas.value[idx] = resp
    return resp
  }

  async function deleteFormula(id: number) {
    await api.delete(`/api/formulas/${id}`)
    formulas.value = formulas.value.filter((f) => f.id !== id)
  }

  async function createFromNL(nlRequest: string, columnHeaders: string[]): Promise<SavedFormula> {
    const resp = await api.post<{ expression: string; name: string; description: string; formula_type: string }>(
      '/api/ai/formula',
      { nl_request: nlRequest, column_headers: columnHeaders },
    )
    return saveFormula({
      name: resp.name,
      expression: resp.expression,
      description: resp.description,
      nl_prompt: nlRequest,
      formula_type: resp.formula_type,
    })
  }

  async function fetchLibrary() {
    try {
      const data = await api.get<SavedFormula[]>('/api/formulas/library')
      libraryFormulas.value = data
    } catch (err) {
      console.error('[formulas] fetchLibrary failed:', err)
    }
  }

  function findByName(name: string): SavedFormula | undefined {
    const lower = name.toLowerCase()
    return formulas.value.find((f) => f.name.toLowerCase() === lower)
  }

  return { formulas, libraryFormulas, loading, fetchFormulas, fetchLibrary, saveFormula, updateFormula, deleteFormula, createFromNL, findByName }
})
