<template>
  <div class="flex max-w-2xl flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('settings.title') }}</h1>

    <section class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.language') }}</h2>
      <div class="flex gap-2">
        <button
          v-for="l in locales" :key="l.code" type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold"
          :class="l.code === locale ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
          :aria-pressed="l.code === locale"
          :data-testid="`settings-locale-${l.code}`"
          @click="changeLocale(l.code as Locale)"
        >
          {{ l.name }}
        </button>
      </div>
    </section>

    <form class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft" novalidate @submit.prevent="saveProfile">
      <h2 class="font-extrabold">{{ $t('settings.profile') }}</h2>
      <label class="label">
        {{ $t('welcome.handle') }}
        <input id="settings-handle" v-model="handle" class="field" maxlength="20" data-testid="settings-handle">
        <span class="font-medium">{{ $t('welcome.handleHint') }}</span>
      </label>
      <label class="label">
        {{ $t('welcome.name') }}
        <input id="settings-name" v-model="name" class="field" maxlength="60" data-testid="settings-name">
      </label>
      <p v-if="errorKey" class="rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral" role="alert">{{ $t(errorKey) }}</p>
      <div class="flex items-center gap-3">
        <UiBtn type="submit" variant="primary" :disabled="saving" data-testid="settings-save">{{ $t('settings.save') }}</UiBtn>
        <span v-if="saved" class="text-sm font-bold text-mint" role="status">{{ $t('settings.saved') }}</span>
      </div>
    </form>

    <section v-if="mode === 'demo'" class="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.demo') }}</h2>
      <p class="text-muted">{{ $t('settings.demoBody') }}</p>
      <div class="flex items-center gap-3">
        <UiBtn data-testid="settings-demo-reset" @click="resetDemo">{{ $t('settings.demoReset') }}</UiBtn>
        <span v-if="resetDone" class="text-sm font-bold text-mint" role="status">{{ $t('settings.demoResetDone') }}</span>
      </div>
    </section>

    <section class="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.account') }}</h2>
      <UiBtn variant="danger" data-testid="settings-signout" @click="leave">{{ $t('nav.signOut') }}</UiBtn>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '~~/shared/types/domain'
import { RepoError } from '~/repositories/types'

const repo = useRepo()
const { mode, me, loadMe, signOut } = useSession()
const { locale, locales, setLocale, t } = useI18n()
const localePath = useLocalePath()
useHead({ title: () => t('settings.title') })

const handle = ref('')
const name = ref('')
const errorKey = ref('')
const saving = ref(false)
const saved = ref(false)
const resetDone = ref(false)

onMounted(async () => {
  const p = await loadMe()
  handle.value = p?.handle ?? ''
  name.value = p?.displayName ?? ''
})

async function changeLocale(code: Locale) {
  await setLocale(code)
  try {
    me.value = await repo.updateProfile({ locale: code })
  }
  catch {
    // The cookie already holds the choice; the profile catches up next time.
  }
}

async function saveProfile() {
  errorKey.value = ''
  saved.value = false
  const h = handle.value.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(h)) {
    errorKey.value = 'welcome.errorHandle'
    return
  }
  saving.value = true
  try {
    me.value = await repo.updateProfile({ handle: h, displayName: name.value })
    saved.value = true
  }
  catch (e) {
    errorKey.value = e instanceof RepoError && e.code === 'handle_taken' ? 'welcome.errorTaken' : 'welcome.errorSave'
  }
  finally {
    saving.value = false
  }
}

async function resetDemo() {
  useDemoRepo().reset()
  await loadMe(true)
  clearNuxtData()
  resetDone.value = true
}

async function leave() {
  await signOut()
  await navigateTo(localePath('/'))
}
</script>
