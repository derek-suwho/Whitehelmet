import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { SavedFormula, FormulaCreate } from '@/types'

export const useFormulasStore = defineStore('formulas', () => {
  const formulas = ref<SavedFormula[]>([])
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

  function findByName(name: string): SavedFormula | undefined {
    const lower = name.toLowerCase()
    return formulas.value.find((f) => f.name.toLowerCase() === lower)
  }

  return { formulas, loading, fetchFormulas, saveFormula, deleteFormula, createFromNL, findByName }
})
