<template>
  <div class="min-h-screen px-4 pb-16 lg:px-8">
    <header class="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 py-4">
      <NuxtLink :to="localePath(user ? '/tracks' : '/')" data-testid="nav-home">
        <UiAppLogo />
      </NuxtLink>
      <nav v-if="user" class="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1" data-testid="nav-main">
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="localePath(item.to)"
          class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-muted"
          active-class="bg-surface text-ink shadow-sm"
        >
          {{ $t(item.label) }}
        </NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <NuxtLink
          v-for="l in otherLocales"
          :key="l.code"
          :to="switchLocalePath(l.code)"
          class="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-surface"
          data-testid="locale-switch"
        >
          {{ l.name }}
        </NuxtLink>
        <button
          v-if="user"
          type="button"
          class="rounded-full bg-surface-2 px-4 py-2 text-sm font-bold"
          data-testid="sign-out"
          @click="signOut"
        >
          {{ $t('nav.signOut') }}
        </button>
      </div>
    </header>
    <main class="mx-auto max-w-[1360px]">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale, locales } = useI18n()

const items = [
  { to: '/tracks', label: 'nav.myTracks' },
  { to: '/explore', label: 'nav.explore' },
  { to: '/friends', label: 'nav.friends' },
  { to: '/settings', label: 'nav.settings' },
]

const otherLocales = computed(() => locales.value.filter(l => l.code !== locale.value))

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo(localePath('/'))
}
</script>
