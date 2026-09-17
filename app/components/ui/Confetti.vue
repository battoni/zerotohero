<template>
  <span v-if="active" class="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
    <i
      v-for="p in pieces"
      :key="p.i"
      class="confetti-piece absolute size-[7px] rounded-[2px]"
      :style="{ background: p.color, '--x': `${p.x}px`, '--y': `${p.y}px` }"
    />
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ trigger: number, radius?: number, count?: number }>(), { radius: 34, count: 12 })
const active = ref(false)
const colors = ['var(--mint)', 'var(--violet)', 'var(--coral)', 'var(--sun)', 'var(--sky)']
const pieces = computed(() => Array.from({ length: props.count }, (_, i) => {
  const a = (Math.PI * 2 * i) / props.count
  return { i, color: colors[i % colors.length], x: Math.round(Math.cos(a) * props.radius), y: Math.round(Math.sin(a) * props.radius) }
}))
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.trigger, () => {
  if (import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  active.value = false
  clearTimeout(timer)
  requestAnimationFrame(() => {
    active.value = true
    timer = setTimeout(() => (active.value = false), 800)
  })
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.confetti-piece { animation: confetti-pop .7s ease-out forwards; }
@keyframes confetti-pop {
  from { transform: translate(0, 0) scale(1); opacity: 1; }
  to { transform: translate(var(--x), var(--y)) scale(.4) rotate(160deg); opacity: 0; }
}
</style>
