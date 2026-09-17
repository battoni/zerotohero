<template>
  <div class="flex flex-col gap-16 pt-10">
    <section class="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <h1 class="text-5xl font-black leading-[.95] tracking-[-.035em] lg:text-[88px]" data-testid="landing-title">
          {{ $t('landing.title') }}
        </h1>
        <p class="mt-5 max-w-[46ch] text-lg text-muted">{{ $t('landing.lede') }}</p>
        <NuxtLink
          :to="localePath(user ? '/tracks' : '/login')"
          class="mt-7 inline-block rounded-full bg-violet px-6 py-3 font-bold text-on-color"
          data-testid="landing-cta"
        >
          {{ $t('landing.cta') }}
        </NuxtLink>
      </div>
      <div class="rounded-[28px] bg-surface p-5 shadow-soft" aria-hidden="true">
        <svg viewBox="0 0 520 300" fill="none" class="block h-auto w-full">
          <path d="M30 250 C 120 250, 110 170, 200 170 S 300 90, 380 110 S 470 60, 480 40" stroke="var(--surface-2)" stroke-width="14" stroke-linecap="round" />
          <path d="M30 250 C 120 250, 110 170, 200 170 S 290 96, 330 100" stroke="var(--mint)" stroke-width="14" stroke-linecap="round" />
          <circle cx="30" cy="250" r="16" fill="var(--mint)" />
          <circle cx="118" cy="214" r="16" fill="var(--mint)" />
          <circle cx="200" cy="170" r="16" fill="var(--mint)" />
          <circle cx="330" cy="100" r="18" fill="var(--surface)" stroke="var(--violet)" stroke-width="6" />
          <circle cx="410" cy="100" r="14" fill="var(--surface)" stroke="var(--surface-2)" stroke-width="5" />
          <circle cx="480" cy="40" r="24" fill="var(--sun)" />
          <path d="M470 40 l7 7 13-14" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </section>

    <section class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="(step, i) in steps" :key="step" class="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-soft">
        <span class="grid size-10 place-items-center rounded-xl text-lg font-black" :class="stepColors[i]">{{ i + 1 }}</span>
        <h3 class="text-lg font-extrabold">{{ $t(`landing.steps.${step}.title`) }}</h3>
        <p class="text-muted">{{ $t(`landing.steps.${step}.body`) }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const localePath = useLocalePath()
const steps = ['create', 'split', 'tick', 'share'] as const
const stepColors = ['bg-violet-soft text-violet', 'bg-sky-soft text-sky', 'bg-mint-soft text-mint', 'bg-coral-soft text-coral']
</script>
