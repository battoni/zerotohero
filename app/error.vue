<template>
  <NuxtLayout>
    <section class="mx-auto flex max-w-xl flex-col items-start gap-4 pt-16" data-testid="error-page">
      <span class="num text-sm font-medium text-violet">{{ error?.statusCode ?? 500 }}</span>
      <h1 class="text-3xl font-black">{{ notFound ? $t('error.notFoundTitle') : $t('error.genericTitle') }}</h1>
      <p class="text-muted">{{ $t('error.body') }}</p>
      <UiBtn variant="primary" data-testid="error-back" @click="leave">
        {{ loggedIn ? $t('error.back') : $t('error.home') }}
      </UiBtn>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError | null }>()
const { loggedIn } = useSession()
const localePath = useLocalePath()
const { t } = useI18n()
const notFound = computed(() => props.error?.statusCode === 404)
useHead({ title: () => (notFound.value ? t('error.notFoundTitle') : t('error.genericTitle')) })

function leave() {
  clearError({ redirect: localePath(loggedIn.value ? '/tracks' : '/') })
}
</script>
