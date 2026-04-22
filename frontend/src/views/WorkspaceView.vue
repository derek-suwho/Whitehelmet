<script setup lang="ts">
import SourcesPanel from '@/components/sources/SourcesPanel.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
</script>

<template>
  <div class="flex flex-1 overflow-hidden pt-14">
    <!-- Desktop: three panels side by side -->
    <!-- Mobile: stack vertically -->
    <div class="flex h-full w-full flex-col md:flex-row">
      <SourcesPanel class="w-full shrink-0 md:w-[280px]" />
      <SpreadsheetEditor class="min-h-[300px] flex-1" />
      <ChatPanel class="w-full shrink-0 md:w-[360px]" />
    </div>
  </div>
</template>
