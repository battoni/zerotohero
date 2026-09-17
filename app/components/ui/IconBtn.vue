<template>
  <button
    type="button"
    class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string, disabled?: boolean }>(), { disabled: false })
</script>
