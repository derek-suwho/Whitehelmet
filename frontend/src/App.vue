<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'

const route = useRoute()
</script>

<template>
  <div class="flex h-screen flex-col">
    <TopBar v-if="route.meta.requiresAuth" />
    <RouterView />
  </div>
</template>
