<template>
  <UiSheet :open="open" :title="title" @close="emit('cancel')">
    <p v-if="body" class="text-muted">{{ body }}</p>
    <div class="flex flex-wrap gap-2">
      <UiBtn :variant="danger ? 'danger' : 'primary'" :disabled="busy" data-testid="confirm-yes" @click="emit('confirm')">{{ confirmLabel }}</UiBtn>
      <UiBtn variant="ghost" data-testid="confirm-no" @click="emit('cancel')">{{ cancelLabel || $t('track.cancel') }}</UiBtn>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
}>(), { body: '', cancelLabel: '', danger: true, busy: false })
const emit = defineEmits<{ confirm: [], cancel: [] }>()
</script>
