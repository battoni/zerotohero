<template>
  <span class="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold italic" :class="classes">
    <slot />
  </span>
</template>

<script setup lang="ts">
import type { Tone } from '~/utils/format'

const props = withDefaults(defineProps<{ tone?: Tone | 'neutral' }>(), { tone: 'neutral' })
const classes = computed(() => ({
  neutral: 'bg-surface-2 text-muted',
  violet: 'bg-violet-soft text-violet',
  sky: 'bg-sky-soft text-sky',
  mint: 'bg-mint-soft text-mint',
  coral: 'bg-coral-soft text-coral',
  sun: 'bg-sun-soft text-sun',
})[props.tone])
</script>
