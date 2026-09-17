<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled"
    class="inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[filter,transform] hover:brightness-105 active:scale-[.98] disabled:cursor-default disabled:opacity-50"
    :class="[variants[variant], size === 'sm' ? 'px-3.5 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm']"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

withDefaults(defineProps<{
  variant?: 'primary' | 'mint' | 'soft' | 'ghost' | 'danger' | 'ink'
  size?: 'sm' | 'md'
  to?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}>(), { variant: 'soft', size: 'md', to: undefined, type: 'button', disabled: false })

const variants = {
  primary: 'bg-violet text-on-color',
  mint: 'bg-mint text-on-color',
  soft: 'bg-surface-2 text-ink',
  ghost: 'bg-transparent text-muted hover:bg-surface-2',
  danger: 'bg-coral text-on-color',
  ink: 'bg-ink text-surface',
}
</script>
