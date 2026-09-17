<template>
  <div class="flex max-w-2xl flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('settings.title') }}</h1>

    <section class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.language') }}</h2>
      <div class="flex gap-2" role="radiogroup" :aria-label="$t('settings.language')">
        <button
          v-for="l in locales" :key="l.code" type="button" role="radio"
          class="rounded-full px-4 py-2 text-sm font-semibold"
          :class="l.code === locale ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
          :aria-checked="l.code === locale"
          :data-testid="`settings-locale-${l.code}`"
          @click="changeLocale(l.code as Locale)"
        >
          {{ l.name }}
        </button>
      </div>
    </section>

    <form class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft" novalidate @submit.prevent="saveProfile">
      <h2 class="font-extrabold">{{ $t('settings.profile') }}</h2>
      <div class="flex flex-col gap-1.5">
        <label class="label" for="settings-handle">{{ $t('welcome.handle') }}</label>
        <input
          id="settings-handle" v-model="handle" class="field" maxlength="20"
          :aria-invalid="handleError || undefined" :aria-describedby="handleError ? 'settings-handle-hint settings-error' : 'settings-handle-hint'"
          data-testid="settings-handle"
        >
        <span id="settings-handle-hint" class="text-[13px] font-medium text-muted">{{ $t('welcome.handleHint') }}</span>
      </div>
      <label class="label">
        {{ $t('welcome.name') }}
        <input id="settings-name" v-model="name" class="field" maxlength="60" data-testid="settings-name">
      </label>
      <p v-if="errorKey" id="settings-error" class="rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral" role="alert">{{ $t(errorKey) }}</p>
      <div class="flex items-center gap-3">
        <UiBtn type="submit" variant="primary" :disabled="saving" data-testid="settings-save">{{ $t('settings.save') }}</UiBtn>
        <span v-if="saved" class="text-sm font-bold text-mint" role="status">{{ $t('settings.saved') }}</span>
      </div>
    </form>

    <section v-if="mode === 'demo'" class="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.demo') }}</h2>
      <p class="text-muted">{{ $t('settings.demoBody') }}</p>
      <div class="flex items-center gap-3">
        <UiBtn data-testid="settings-demo-reset" @click="confirmReset = true">{{ $t('settings.demoReset') }}</UiBtn>
        <span v-if="resetDone" class="text-sm font-bold text-mint" role="status">{{ $t('settings.demoResetDone') }}</span>
      </div>
    </section>

    <section class="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-soft">
      <h2 class="font-extrabold">{{ $t('settings.account') }}</h2>
      <UiBtn variant="danger" data-testid="settings-signout" @click="leave">{{ $t('nav.signOut') }}</UiBtn>
    </section>

    <UiConfirm
      :open="confirmReset"
      :title="$t('settings.demoResetTitle')"
      :body="$t('settings.demoResetBody')"
      :confirm-label="$t('settings.demoResetYes')"
      @confirm="resetDemo"
      @cancel="confirmReset = false"
    />
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
const handleError = computed(() => errorKey.value === 'welcome.errorHandle' || errorKey.value === 'welcome.errorTaken')
const saving = ref(false)
const saved = ref(false)
const resetDone = ref(false)
const confirmReset = ref(false)

function fillFrom(p: { handle: string, displayName: string | null } | null) {
  handle.value = p?.handle ?? ''
  name.value = p?.displayName ?? ''
}

onMounted(async () => fillFrom(await loadMe()))
watch([handle, name], () => (saved.value = false))

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
    document.getElementById('settings-handle')?.focus()
    return
  }
  saving.value = true
  try {
    me.value = await repo.updateProfile({ handle: h, displayName: name.value })
    fillFrom(me.value)
    await nextTick()
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
  confirmReset.value = false
  useDemoRepo().reset()
  fillFrom(await loadMe(true))
  clearNuxtData()
  resetDone.value = true
}

async function leave() {
  await signOut()
  await navigateTo(localePath('/'))
}
</script>
