<script setup lang="ts">
import type { SchemaColumn } from '@/types/database'

type ValidationRule = NonNullable<SchemaColumn['validation']>

const props = defineProps<{
  modelValue: ValidationRule
  fieldType: 'text' | 'number' | 'date' | 'percentage'
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ValidationRule] }>()

function update(patch: Partial<ValidationRule>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <div class="space-y-2 text-sm">
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        :checked="modelValue.required"
        class="rounded border-gray-300"
        @change="update({ required: ($event.target as HTMLInputElement).checked })"
      />
      <span class="text-gray-700">Required</span>
    </label>

    <template v-if="fieldType === 'number' || fieldType === 'percentage'">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="block text-xs text-gray-500 mb-0.5">Min</label>
          <input
            type="number"
            :value="modelValue.min"
            class="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
            @input="update({ min: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
        </div>
        <div class="flex-1">
          <label class="block text-xs text-gray-500 mb-0.5">Max</label>
          <input
            type="number"
            :value="modelValue.max"
            class="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
            @input="update({ max: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
        </div>
      </div>
    </template>

    <template v-if="fieldType === 'text'">
      <div>
        <label class="block text-xs text-gray-500 mb-0.5">Allowed values (comma-separated)</label>
        <input
          type="text"
          :value="modelValue.options?.join(', ')"
          placeholder="e.g. Yes, No, N/A"
          class="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          @input="update({ options: ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) })"
        />
      </div>
    </template>
  </div>
</template>
