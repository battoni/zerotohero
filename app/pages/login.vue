<template>
  <div class="mx-auto flex max-w-md flex-col gap-6 pt-16">
    <div>
      <h1 class="text-4xl font-black">{{ $t('login.title') }}</h1>
      <p class="mt-2 text-muted">{{ $t('login.lede') }}</p>
    </div>
    <div v-if="mode === 'demo'" class="flex flex-col items-start gap-3 rounded-card bg-violet-soft p-5" data-testid="login-demo">
      <h2 class="text-lg font-extrabold">{{ $t('login.demoTitle') }}</h2>
      <p class="text-muted">{{ $t('login.demoBody') }}</p>
      <UiBtn variant="primary" data-testid="login-demo-enter" @click="demo">{{ $t('login.demoCta') }}</UiBtn>
    </div>
    <div v-else class="flex flex-col gap-3">
      <button type="button" class="rounded-full bg-ink px-5 py-3 font-bold text-surface" data-testid="login-google" @click="oauth('google')">
        {{ $t('login.google') }}
      </button>
      <button type="button" class="rounded-full bg-surface-2 px-5 py-3 font-bold" data-testid="login-github" @click="oauth('github')">
        {{ $t('login.github') }}
      </button>
    </div>

    <form v-if="devLogin && mode === 'supabase'" class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft" data-testid="login-dev" @submit.prevent="password">
      <h2 class="font-extrabold">{{ $t('login.devTitle') }}</h2>
      <label class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('login.email') }}
        <input id="login-email" v-model="email" type="email" autocomplete="username" class="field" data-testid="login-email">
      </label>
      <label class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('login.password') }}
        <input id="login-password" v-model="pass" type="password" autocomplete="current-password" class="field" data-testid="login-password">
      </label>
      <button type="submit" class="rounded-full bg-violet px-5 py-2.5 font-bold text-on-color" data-testid="login-submit">
        {{ $t('login.submit') }}
      </button>
    </form>

    <p v-if="error" class="rounded-xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral" role="alert" data-testid="login-error">
      {{ $t('login.errorGeneric') }}
    </p>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const localePath = useLocalePath()
const devLogin = import.meta.dev || config.public.devLogin === 'true'
const { mode, enterDemo } = useSession()
const { t } = useI18n()
useHead({ title: () => t('login.title') })

async function demo() {
  enterDemo()
  await navigateTo(localePath('/tracks'))
}

const email = ref('')
const pass = ref('')
const error = ref('')

async function oauth(provider: 'google' | 'github') {
  error.value = ''
  const { error: e } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${config.public.siteUrl}${localePath('/confirm')}` },
  })
  if (e) error.value = e.message
}

async function password() {
  error.value = ''
  const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: pass.value })
  if (e) {
    error.value = e.message
    return
  }
  await navigateTo(localePath('/tracks'))
}
</script>
