<script setup lang="ts">
import type { SchemaColumn } from '@/types/database'
import ColumnRow from './ColumnRow.vue'

const props = defineProps<{ modelValue: SchemaColumn[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: SchemaColumn[]] }>()

function updateColumn(index: number, updated: SchemaColumn) {
  const cols = [...props.modelValue]
  cols[index] = updated
  emit('update:modelValue', cols)
}

function removeColumn(index: number) {
  const cols = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', cols)
}

function moveUp(index: number) {
  if (index === 0) return
  const cols = [...props.modelValue]
  ;[cols[index - 1], cols[index]] = [cols[index], cols[index - 1]]
  emit('update:modelValue', cols)
}

function moveDown(index: number) {
  if (index === props.modelValue.length - 1) return
  const cols = [...props.modelValue]
  ;[cols[index], cols[index + 1]] = [cols[index + 1], cols[index]]
  emit('update:modelValue', cols)
}

function addColumn() {
  const newCol: SchemaColumn = {
    id: crypto.randomUUID(),
    name: '',
    type: 'text',
  }
  emit('update:modelValue', [...props.modelValue, newCol])
}
</script>

<template>
  <div class="space-y-2">
    <ColumnRow
      v-for="(col, i) in modelValue"
      :key="col.id"
      :column="col"
      :index="i"
      :total="modelValue.length"
      @update="updateColumn(i, $event)"
      @remove="removeColumn(i)"
      @move-up="moveUp(i)"
      @move-down="moveDown(i)"
    />
    <button
      class="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      @click="addColumn"
    >
      + Add Column
    </button>
  </div>
</template>
