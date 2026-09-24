<template>
  <article class="mx-auto flex max-w-2xl flex-col gap-6 pt-10" :data-testid="`legal-${doc}`">
    <header>
      <h1 class="text-4xl font-black">{{ $t(`legal.${doc}.title`) }}</h1>
      <p class="mt-2 text-sm text-muted">{{ $t('legal.updated', { date: formatDate(LEGAL_UPDATED, locale, { dateStyle: 'long' }) }) }}</p>
      <p class="mt-4 text-lg text-muted">{{ $t(`legal.${doc}.intro`) }}</p>
    </header>
    <section v-for="s in sections" :key="s" class="rounded-card bg-surface p-5 shadow-soft">
      <h2 class="text-lg font-extrabold">{{ $t(`legal.${doc}.${s}.title`) }}</h2>
      <p class="mt-2 whitespace-pre-line">{{ $t(`legal.${doc}.${s}.body`, { email: LEGAL_CONTACT }) }}</p>
    </section>
    <p class="text-muted">
      {{ $t('legal.contact') }}
      <a :href="`mailto:${LEGAL_CONTACT}`" class="font-semibold text-violet underline">{{ LEGAL_CONTACT }}</a>
    </p>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{ doc: 'privacy' | 'terms', sections: readonly string[] }>()
const { locale, t } = useI18n()
useHead({ title: () => t(`legal.${props.doc}.title`) })
</script>
