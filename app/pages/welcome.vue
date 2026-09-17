<template>
  <div class="mx-auto flex max-w-lg flex-col gap-5 pt-12">
    <div>
      <h1 class="text-3xl font-black">{{ $t('welcome.title') }}</h1>
      <p class="mt-2 text-muted">{{ $t('welcome.lede') }}</p>
    </div>
    <form class="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-soft" novalidate data-testid="welcome-form" @submit.prevent="save">
      <label class="label">
        {{ $t('welcome.handle') }}
        <span class="flex items-center gap-1 rounded-xl bg-surface-2 pl-3">
          <span class="font-bold text-muted">@</span>
          <input id="welcome-handle" v-model="handle" class="field pl-0" autocomplete="username" maxlength="20" :aria-invalid="!!errorKey || undefined" :aria-describedby="errorKey ? 'welcome-handle-hint welcome-error' : 'welcome-handle-hint'" data-testid="welcome-handle">
        </span>
      </label>
      <span id="welcome-handle-hint" class="-mt-2 text-[13px] font-medium text-muted">{{ $t('welcome.handleHint') }}</span>
      <label class="label">
        {{ $t('welcome.name') }}
        <input id="welcome-name" v-model="name" class="field" maxlength="60" autocomplete="name" data-testid="welcome-name">
      </label>
      <div class="label">
        {{ $t('welcome.language') }}
        <div class="flex gap-2" role="radiogroup" :aria-label="$t('welcome.language')">
          <button
            v-for="l in locales" :key="l.code" type="button" role="radio"
            class="rounded-full px-4 py-2 text-sm font-semibold"
            :class="lang === l.code ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
            :aria-checked="lang === l.code"
            @click="lang = l.code as Locale"
          >
            {{ l.name }}
          </button>
        </div>
      </div>
      <p v-if="errorKey" id="welcome-error" class="rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral" role="alert">{{ $t(errorKey) }}</p>
      <UiBtn type="submit" variant="primary" :disabled="saving" data-testid="welcome-submit">{{ $t('welcome.submit') }}</UiBtn>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '~~/shared/types/domain'
import { RepoError } from '~/repositories/types'

const repo = useRepo()
const { loadMe, me } = useSession()
const { locale, locales, setLocale, t } = useI18n()
const localePath = useLocalePath()
useHead({ title: () => t('welcome.title') })

const handle = ref('')
const name = ref('')
const lang = ref<Locale>(locale.value as Locale)
const errorKey = ref('')
const saving = ref(false)

onMounted(async () => {
  const p = await loadMe()
  if (!p) return
  if (!p.handle.startsWith('user_')) handle.value = p.handle
  name.value = p.displayName ?? ''
})

async function save() {
  errorKey.value = ''
  const h = handle.value.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(h)) {
    errorKey.value = 'welcome.errorHandle'
    document.getElementById('welcome-handle')?.focus()
    return
  }
  saving.value = true
  try {
    me.value = await repo.updateProfile({ handle: h, displayName: name.value, locale: lang.value, onboarded: true })
    await setLocale(lang.value)
    await navigateTo(localePath('/tracks', lang.value))
  }
  catch (e) {
    errorKey.value = e instanceof RepoError && e.code === 'handle_taken' ? 'welcome.errorTaken' : 'welcome.errorSave'
  }
  finally {
    saving.value = false
  }
}
</script>
