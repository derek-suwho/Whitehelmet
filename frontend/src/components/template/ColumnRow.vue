<script setup lang="ts">
import type { SchemaColumn } from '@/types/database'
import FieldTypeSelect from './FieldTypeSelect.vue'
import ValidationRuleBuilder from './ValidationRuleBuilder.vue'

const props = defineProps<{ column: SchemaColumn; index: number; total: number }>()
const emit = defineEmits<{
  update: [value: SchemaColumn]
  remove: []
  'move-up': []
  'move-down': []
}>()

function update(patch: Partial<SchemaColumn>) {
  emit('update', { ...props.column, ...patch })
}
</script>

<template>
  <div class="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
    <div class="flex items-center gap-2">
      <div class="flex flex-col gap-0.5">
        <button
          :disabled="index === 0"
          class="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
          title="Move up"
          @click="$emit('move-up')"
        >▲</button>
        <button
          :disabled="index === total - 1"
          class="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
          title="Move down"
          @click="$emit('move-down')"
        >▼</button>
      </div>
      <input
        :value="column.name"
        type="text"
        placeholder="Column name"
        class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-medium"
        @input="update({ name: ($event.target as HTMLInputElement).value })"
      />
      <FieldTypeSelect
        :model-value="column.type"
        class="w-32"
        @update:model-value="update({ type: $event })"
      />
      <button
        class="text-red-400 hover:text-red-600 px-1"
        title="Remove column"
        @click="$emit('remove')"
      >✕</button>
    </div>

    <input
      :value="column.description"
      type="text"
      placeholder="Description (optional)"
      class="block w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
      @input="update({ description: ($event.target as HTMLInputElement).value })"
    />

    <ValidationRuleBuilder
      :model-value="column.validation ?? {}"
      :field-type="column.type"
      @update:model-value="update({ validation: $event })"
    />

    <div v-if="column.formula_id" class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
      Formula attached
    </div>
  </div>
</template>
