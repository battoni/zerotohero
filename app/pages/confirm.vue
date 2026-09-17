<template>
  <p class="pt-16 text-center text-muted" data-testid="confirm-loading">{{ $t('confirm.loading') }}</p>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const { afterSignIn } = useSession()

let done = false
watch(user, (u) => {
  if (u && !done) {
    done = true
    afterSignIn()
  }
}, { immediate: true })
</script>
