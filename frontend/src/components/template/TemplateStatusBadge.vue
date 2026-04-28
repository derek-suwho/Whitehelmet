<script setup lang="ts">
defineProps<{ status: 'draft' | 'active' | 'deprecated' }>()

const styles = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  deprecated: 'bg-red-100 text-red-700',
}
</script>

<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize" :class="styles[status]">
    {{ status }}
  </span>
</template>
