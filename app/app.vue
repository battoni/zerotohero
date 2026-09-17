<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { locale } = useI18n()
useHead({
  htmlAttrs: { lang: locale },
  titleTemplate: title => (title && title !== 'Zero to Hero' ? `${title} · Zero to Hero` : 'Zero to Hero'),
})
</script>
