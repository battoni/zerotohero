<template>
  <div class="flex flex-col gap-4 pt-6">
    <h1 class="text-3xl font-black">{{ $t('nav.settings') }}</h1>
    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-bold text-muted">{{ $t('settings.language') }}</span>
      <div class="flex gap-2">
        <NuxtLink
          v-for="l in locales"
          :key="l.code"
          :to="switchLocalePath(l.code)"
          class="rounded-full px-4 py-2 text-sm font-semibold"
          :class="l.code === locale ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
          :data-testid="`settings-locale-${l.code}`"
        >
          {{ l.name }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
</script>
