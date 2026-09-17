<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(640px,calc(100vw-32px))] rounded-[26px] bg-surface p-0 text-ink shadow-soft backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    :aria-labelledby="titleId"
    @close="onClosed"
    @click="onBackdrop"
  >
    <div class="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <h2 :id="titleId" class="text-xl font-black" :class="{ 'sr-only': hideTitle }">{{ title }}</h2>
        <button type="button" class="ml-auto grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold" :aria-label="$t('common.close')" data-testid="sheet-close" @click="close">
          ×
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean, title: string, hideTitle?: boolean }>(), { hideTitle: false })
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
let opener: HTMLElement | null = null

function show() {
  const el = dialog.value
  if (!el || el.open) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  el.showModal()
}

watch(() => props.open, (open) => {
  if (open) show()
  else if (dialog.value?.open) dialog.value.close()
}, { flush: 'post' })

onMounted(() => {
  if (props.open) show()
})

function close() {
  dialog.value?.close()
}

function onClosed() {
  emit('close')
  // Give focus back to what opened the dialog, if it is still on the page.
  const target = opener
  opener = null
  nextTick(() => {
    if (target?.isConnected) target.focus()
  })
}

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) close()
}
</script>
