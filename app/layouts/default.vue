<template>
  <div class="min-h-screen px-4 pb-16 lg:px-8">
    <header class="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 py-4">
      <div class="flex items-center gap-2">
        <NuxtLink :to="localePath(loggedIn ? '/tracks' : '/')" data-testid="nav-home">
          <UiAppLogo />
        </NuxtLink>
        <span v-if="mode === 'demo' && loggedIn" class="rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sun" data-testid="demo-badge">{{ $t('nav.demoBadge') }}</span>
      </div>
      <nav v-if="loggedIn" class="order-3 flex w-full flex-wrap justify-center gap-1 rounded-full bg-surface-2 p-1 sm:order-none sm:w-auto" data-testid="nav-main">
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="localePath(item.to)"
          class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-muted hover:text-ink"
          active-class="bg-surface text-ink! shadow-sm"
          :data-testid="`nav-${item.id}`"
        >
          {{ $t(item.label) }}
        </NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <NuxtLink
          v-for="l in otherLocales"
          :key="l.code"
          :to="switchLocalePath(l.code)"
          :lang="l.language"
          class="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-surface"
          data-testid="locale-switch"
        >
          {{ l.name }}
        </NuxtLink>
        <ClientOnly>
          <NuxtLink v-if="loggedIn && me" :to="localePath(`/u/${me.handle}`)" :aria-label="$t('nav.profile')" data-testid="nav-profile">
            <UiAvatar :profile="me" />
          </NuxtLink>
        </ClientOnly>
      </div>
    </header>
    <main class="mx-auto max-w-[1360px]">
      <slot />
    </main>
    <footer class="mx-auto mt-16 flex max-w-[1360px] flex-wrap justify-center gap-4 text-[13px] font-semibold text-muted" data-testid="footer">
      <NuxtLink :to="localePath('/privacidade')" class="hover:text-ink" data-testid="footer-privacy">{{ $t('legal.privacy.title') }}</NuxtLink>
      <NuxtLink :to="localePath('/termos')" class="hover:text-ink" data-testid="footer-terms">{{ $t('legal.terms.title') }}</NuxtLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { mode, loggedIn, me, loadMe } = useSession()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale, locales } = useI18n()

const items = [
  { id: 'tracks', to: '/tracks', label: 'nav.myTracks' },
  { id: 'explore', to: '/explore', label: 'nav.explore' },
  { id: 'friends', to: '/friends', label: 'nav.friends' },
  { id: 'settings', to: '/settings', label: 'nav.settings' },
]

const otherLocales = computed(() => locales.value.filter(l => l.code !== locale.value))

onMounted(() => {
  if (loggedIn.value) loadMe().catch(() => {})
})
watch(loggedIn, (v) => {
  if (v) loadMe().catch(() => {})
})
</script>
