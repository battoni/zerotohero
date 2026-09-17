<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
// lang on <html>, hreflang alternates, canonical and og:locale for the current route.
const i18nHead = useLocaleHead({ seo: true })
useHead({
  htmlAttrs: { lang: locale },
  link: () => i18nHead.value.link ?? [],
  meta: () => i18nHead.value.meta ?? [],
  titleTemplate: title => (title && title !== 'Zero to Hero' ? `${title} · Zero to Hero` : 'Zero to Hero'),
})
useSeoMeta({
  description: () => t('meta.description'),
  ogTitle: 'Zero to Hero',
  ogDescription: () => t('meta.ogDescription'),
  twitterCard: 'summary',
})
</script>
