<template>
  <p class="pt-16 text-center text-muted" data-testid="confirm-loading">{{ $t('confirm.loading') }}</p>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const localePath = useLocalePath()

watch(user, (u) => {
  if (u) navigateTo(localePath('/tracks'))
}, { immediate: true })
</script>
