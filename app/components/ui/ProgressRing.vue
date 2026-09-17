<template>
  <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`${value}%`">
    <svg viewBox="0 0 36 36" class="size-full -rotate-90">
      <circle cx="18" cy="18" r="15" fill="none" :stroke-width="stroke" :class="light ? 'stroke-white/30' : 'stroke-surface-2'" />
      <circle
        cx="18" cy="18" r="15" fill="none" :stroke-width="stroke" stroke-linecap="round"
        :class="light ? 'stroke-white' : 'stroke-mint'"
        :stroke-dasharray="CIRC" :stroke-dashoffset="CIRC * (1 - value / 100)"
        style="transition: stroke-dashoffset .5s ease"
      />
    </svg>
    <b class="num absolute inset-0 grid place-items-center font-extrabold" :style="{ fontSize: `${Math.round(size * 0.24)}px` }">{{ value }}%</b>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ value: number, size?: number, stroke?: number, light?: boolean }>(), { size: 48, stroke: 4, light: false })
const CIRC = 2 * Math.PI * 15
</script>
