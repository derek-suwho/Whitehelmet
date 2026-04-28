<script setup lang="ts">
defineProps<{ modelValue: 'text' | 'number' | 'date' | 'percentage' }>()
defineEmits<{ 'update:modelValue': [value: 'text' | 'number' | 'date' | 'percentage'] }>()
</script>

<template>
  <select
    :value="modelValue"
    class="block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as 'text' | 'number' | 'date' | 'percentage')"
  >
    <option value="text">Text</option>
    <option value="number">Number</option>
    <option value="date">Date</option>
    <option value="percentage">Percentage</option>
  </select>
</template>
