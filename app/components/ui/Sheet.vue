<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(640px,calc(100vw-32px))] rounded-[26px] bg-surface p-0 text-ink shadow-soft backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    :aria-labelledby="titleId"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <div class="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <h2 :id="titleId" class="text-xl font-black">{{ title }}</h2>
        <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold" :aria-label="$t('common.close')" data-testid="sheet-close" @click="close">
          ×
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean, title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(() => props.open, (open) => {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) el.showModal()
  if (!open && el.open) el.close()
}, { flush: 'post' })

onMounted(() => {
  if (props.open) dialog.value?.showModal()
})

function close() {
  dialog.value?.close()
}

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) close()
}
</script>
