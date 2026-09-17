<template>
  <div class="flex flex-col gap-5 pt-4">
    <UiState :pending="detail === undefined && !error" :error="error" :rows="3" @retry="refresh">
      <p v-if="!detail" class="rounded-card bg-surface p-6 font-semibold shadow-soft" data-testid="profile-not-found">{{ $t('profile.notFound') }}</p>
      <div v-else class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section class="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-soft">
          <div class="flex flex-wrap items-center gap-3">
            <UiAvatar :profile="detail.profile" :size="56" />
            <div class="flex min-w-0 flex-1 flex-col">
              <h1 class="text-2xl font-black" data-testid="profile-name">{{ detail.profile.displayName || detail.profile.handle }}</h1>
              <span class="text-[13px] text-muted">
                @{{ detail.profile.handle }} ·
                {{ $t('profile.trailsActive', { count: detail.activeTracks }, detail.activeTracks) }} ·
                {{ $t('profile.trailsDone', { count: detail.finishedTracks }) }}
              </span>
            </div>
            <UiBtn v-if="detail.friendState === 'self'" size="sm" :to="localePath('/settings')">{{ $t('profile.editProfile') }}</UiBtn>
            <UiBtn v-else-if="detail.friendState === 'none'" size="sm" variant="primary" data-testid="profile-add" @click="add">{{ $t('profile.addFriend') }}</UiBtn>
            <UiBtn v-else-if="detail.friendState === 'incoming'" size="sm" variant="mint" data-testid="profile-accept" @click="add">{{ $t('profile.acceptRequest') }}</UiBtn>
            <span v-else-if="detail.friendState === 'outgoing'" class="text-[13px] font-bold text-muted">{{ $t('profile.requestSent') }}</span>
            <span v-else class="text-[13px] font-bold text-mint">✓ {{ $t('profile.friends') }}</span>
          </div>

          <div class="grid grid-cols-3 gap-2.5" data-testid="profile-stats">
            <div v-for="s in stats" :key="s.label" class="rounded-2xl bg-surface-2 p-3">
              <span class="num block text-2xl font-black">{{ s.value }}</span>
              <span class="text-[13px] text-muted">{{ s.label }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-xs font-bold text-muted">{{ $t('profile.heatmap') }}</span>
            <div class="grid grid-cols-10 gap-1 sm:grid-cols-20" role="img" :aria-label="$t('profile.heatmapLabel')" data-testid="profile-heatmap">
              <i
                v-for="(c, i) in weeks" :key="i"
                class="aspect-square rounded-[4px]"
                :class="heatClass[heatLevel(c, maxWeek)]"
                :title="`${c}`"
              />
            </div>
          </div>
        </section>

        <aside class="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-soft">
          <h2 class="font-extrabold">{{ $t('profile.trails') }}</h2>
          <p v-if="!detail.tracks.length" class="text-[13px] text-muted">{{ $t('profile.noTrails') }}</p>
          <NuxtLink
            v-for="tr in detail.tracks" :key="tr.id"
            :to="localePath(`/tracks/${tr.id}`)"
            class="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5 hover:brightness-[.98]"
          >
            <span class="grid size-11 shrink-0 place-items-center rounded-xl text-xl" :class="`cover-${tr.color}`" aria-hidden="true">{{ tr.emoji }}</span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-bold">{{ tr.title }}</span>
              <span class="num text-xs text-muted">{{ $t('track.progress', { done: tr.done, total: tr.total }) }}</span>
            </span>
            <UiProgressRing :value="percent(tr.done, tr.total)" :size="44" />
          </NuxtLink>
        </aside>
      </div>
    </UiState>
  </div>
</template>

<script setup lang="ts">
import { heatLevel, percent, weeklyCounts } from '~~/shared/utils/progress'

const route = useRoute()
const repo = useRepo()
const localePath = useLocalePath()
const { t } = useI18n()
const handle = computed(() => String(route.params.handle))

const { data: detail, error, refresh } = useAsyncData(() => `profile-${handle.value}`, () => repo.profile(handle.value), { server: false, watch: [handle] })
useHead({ title: () => detail.value?.profile.displayName || `@${handle.value}` })

const weeks = computed(() => weeklyCounts(detail.value?.completedAt ?? [], new Date(), 20))
const maxWeek = computed(() => Math.max(0, ...weeks.value))
const heatClass = ['bg-surface-2', 'bg-violet-soft', 'bg-violet/55', 'bg-violet'] as const
const stats = computed(() => [
  { label: t('profile.milestones'), value: detail.value?.completedAt.length ?? 0 },
  { label: t('profile.evidence'), value: detail.value?.evidenceCount ?? 0 },
  { label: t('profile.certificates'), value: detail.value?.certificateCount ?? 0 },
])

async function add() {
  if (!detail.value) return
  try {
    await repo.requestFriend(detail.value.profile.id)
  }
  finally {
    await refresh()
  }
}
</script>
