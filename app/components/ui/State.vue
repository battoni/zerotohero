<template>
  <div v-if="pending" class="flex flex-col gap-3" data-testid="state-loading" aria-busy="true">
    <span class="sr-only">{{ $t('common.loading') }}</span>
    <div v-for="i in rows" :key="i" class="h-20 animate-pulse rounded-card bg-surface-2" />
  </div>
  <div v-else-if="error" class="flex flex-wrap items-center gap-3 rounded-card bg-coral-soft p-4 font-semibold text-coral" role="alert" data-testid="state-error">
    <span>{{ message || $t('common.error') }}</span>
    <UiBtn size="sm" variant="danger" @click="emit('retry')">{{ $t('common.retry') }}</UiBtn>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
withDefaults(defineProps<{ pending: boolean, error?: unknown, message?: string, rows?: number }>(), { error: undefined, message: '', rows: 3 })
const emit = defineEmits<{ retry: [] }>()
</script>
