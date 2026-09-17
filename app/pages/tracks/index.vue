<template>
  <div class="flex flex-col gap-5 pt-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <ClientOnly>
          <span class="text-[13px] text-muted">{{ today }}</span>
        </ClientOnly>
        <h1 class="text-2xl font-black sm:text-3xl" data-testid="home-greeting">
          {{ greetName ? $t('home.greeting', { name: greetName }) : $t('home.greetingNoName') }}
        </h1>
      </div>
      <UiBtn variant="primary" :to="localePath('/tracks/new')" data-testid="home-new">+ {{ $t('home.newTrack') }}</UiBtn>
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-mint-soft px-4 py-3" data-testid="home-week">
      <template v-if="weekCount">
        <b class="text-mint">{{ $t('home.weekStrip', { count: weekCount }, weekCount) }}</b>
      </template>
      <span v-else class="font-semibold">{{ $t('home.weekStripEmpty') }}</span>
      <span v-if="friendsMoving" class="text-muted">{{ $t('home.friendsMoving') }}</span>
    </div>

    <UiState :pending="data === undefined && !error" :error="error" @retry="refresh">
      <div class="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]" data-testid="home-tracks">
        <TrackCard v-for="tr in tracks" :key="tr.id" :track="tr" />
        <NuxtLink
          :to="localePath('/tracks/new')"
          class="grid min-h-[190px] place-items-center rounded-[20px] border-2 border-dashed border-line p-4 text-center font-bold text-muted hover:bg-surface"
        >
          <div>
            <span class="block text-4xl text-violet">+</span>
            {{ $t('home.newTrack') }}<br>
            <span class="text-[13px] font-medium">{{ $t('home.newTrackHint') }}</span>
          </div>
        </NuxtLink>
      </div>
      <div v-if="!tracks?.length" class="mt-4 flex flex-wrap items-center gap-3 text-muted" data-testid="tracks-empty">
        <span>{{ $t('home.empty') }}</span>
        <UiBtn size="sm" :to="localePath('/explore')">{{ $t('home.emptyCta') }}</UiBtn>
      </div>
    </UiState>
  </div>
</template>

<script setup lang="ts">
import { completedThisWeek } from '~~/shared/utils/progress'

const repo = useRepo()
const { me, loadMe } = useSession()
const localePath = useLocalePath()
const { t, locale } = useI18n()
useHead({ title: () => t('nav.myTracks') })

// Filled after mount: the profile loads in the browser, so the server renders without it.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const greetName = computed(() => (mounted.value ? me.value?.displayName || me.value?.handle || '' : ''))
const today = computed(() => formatDate(new Date(), locale.value, { weekday: 'long', day: 'numeric', month: 'long' }))

const { data, error, refresh } = useAsyncData('home', async () => {
  const [tracks, feed] = await Promise.all([repo.listMyTracks(), repo.feed(), loadMe()])
  return { tracks, feed }
}, { server: false })

const tracks = computed(() => data.value?.tracks ?? [])
const weekCount = computed(() => {
  const mine = (data.value?.feed ?? []).filter(f => f.actor.id === me.value?.id && f.type === 'milestone_completed')
  return completedThisWeek(mine.map(f => f.createdAt), new Date())
})
const friendsMoving = computed(() => {
  const since = Date.now() - 7 * 86_400_000
  return (data.value?.feed ?? []).some(f => f.actor.id !== me.value?.id && new Date(f.createdAt).getTime() >= since)
})
</script>
