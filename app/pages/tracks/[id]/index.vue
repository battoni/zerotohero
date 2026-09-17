<template>
  <div class="flex flex-col gap-5 pt-4">
    <UiState :pending="track === undefined && !error" :error="track ? null : error" :message="$t('track.loadError')" :rows="4" @retry="refresh">
      <div v-if="!track" class="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-soft" data-testid="track-not-found">
        <p class="font-semibold">{{ $t('track.notFound') }}</p>
        <UiBtn :to="localePath('/tracks')">{{ $t('track.back') }}</UiBtn>
      </div>

      <template v-else>
        <header
          class="relative grid gap-4 overflow-hidden rounded-[22px] p-5 text-white sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          :class="`cover-${track.color}`"
          data-testid="track-header"
        >
          <span class="absolute -bottom-16 -right-10 size-56 rounded-full bg-white/12" aria-hidden="true" />
          <div class="relative flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold opacity-85">
              <span aria-hidden="true">{{ track.emoji }}</span>
              {{ $t(`track.visibilityShort.${track.visibility}`) }}
              <template v-if="track.copiesCount"> · {{ $t('track.copiedTimes', { count: track.copiesCount }, track.copiesCount) }}</template>
              <template v-if="!track.isOwner"> · {{ $t('track.by', { name: track.owner.displayName || track.owner.handle }) }}</template>
            </span>
            <h1 class="text-3xl font-black leading-tight outline-none sm:text-4xl" tabindex="-1" data-testid="track-title">{{ track.title }}</h1>
            <p v-if="track.goal" class="max-w-[60ch] opacity-90">{{ track.goal }}</p>
            <p v-if="forecastText" class="text-[13px] font-semibold opacity-90" data-testid="track-forecast">{{ forecastText }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <template v-if="track.isOwner">
                <UiBtn size="sm" variant="ink" :to="localePath(`/tracks/${track.id}/edit`)" data-testid="track-edit">{{ $t('track.edit') }}</UiBtn>
                <UiBtn size="sm" variant="ghost" class="text-white! hover:bg-white/15!" data-testid="track-delete" @click="confirmDelete = true">{{ $t('track.delete') }}</UiBtn>
              </template>
              <template v-else>
                <UiBtn size="sm" variant="ink" :to="localePath(`/tracks/new?from=${track.id}`)" data-testid="track-copy">{{ $t('track.useTemplate') }}</UiBtn>
                <UiBtn size="sm" variant="ghost" class="bg-white/15! text-white!" :disabled="busy" :data-on="track.isFollowing" data-testid="track-follow" @click="toggleFollow">
                  {{ track.isFollowing ? $t('track.following') : $t('track.follow') }}
                </UiBtn>
              </template>
            </div>
          </div>
          <UiProgressRing :value="pct" :size="104" :stroke="3.5" light class="relative" data-testid="track-progress" />
        </header>

        <p v-if="actionError" class="rounded-xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral" role="alert" data-testid="track-action-error">{{ $t('track.actionError') }}</p>

        <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section class="rounded-card bg-surface p-5 shadow-soft">
            <TrackTrail :phases="track.phases" :editable="track.isOwner" :bursts="bursts" @toggle="onToggle" />
          </section>

          <aside class="flex flex-col gap-3.5">
            <div class="flex flex-col gap-2.5 rounded-[18px] bg-violet-soft p-4" data-testid="track-next">
              <span class="text-xs font-bold text-muted">{{ track.done === track.total && track.total ? $t('track.allDone') : $t('track.next') }}</span>
              <h2 v-if="next" class="font-extrabold">{{ next.title }}</h2>
              <UiBtn v-if="next && track.isOwner" variant="primary" data-testid="track-complete-next" @click="openSheet(next)">{{ $t('track.completeWithEvidence') }}</UiBtn>
            </div>

            <div class="flex flex-col gap-2.5 rounded-[18px] bg-surface p-4 shadow-soft" data-testid="track-followers">
              <h2 class="font-extrabold">{{ $t('track.followers') }}</h2>
              <div v-if="track.followers.length" class="flex flex-wrap items-center gap-2">
                <div class="flex">
                  <NuxtLink v-for="f in track.followers.slice(0, 6)" :key="f.id" :to="localePath(`/u/${f.handle}`)" class="-ml-1.5 rounded-full ring-2 ring-surface first:ml-0" :aria-label="f.displayName || f.handle">
                    <UiAvatar :profile="f" />
                  </NuxtLink>
                </div>
                <span class="text-[13px] text-muted">{{ track.followers.map(f => f.displayName || f.handle).join(', ') }}</span>
              </div>
              <p v-else class="text-[13px] text-muted">{{ track.visibility === 'public' ? $t('track.noFollowersPublic') : $t('track.noFollowers') }}</p>
            </div>

            <div class="flex flex-col gap-2.5 rounded-[18px] bg-surface p-4 shadow-soft" data-testid="track-evidence">
              <h2 class="font-extrabold">{{ $t('track.evidence') }}</h2>
              <p v-if="!track.recentEvidence.length" class="text-[13px] text-muted">{{ $t('track.noEvidence') }}</p>
              <div v-for="e in track.recentEvidence" :key="e.id" class="flex items-start gap-2.5 text-sm">
                <span class="grid size-9 shrink-0 place-items-center rounded-[10px] font-extrabold" :class="evidenceTone[e.kind]" aria-hidden="true">{{ evidenceIcon[e.kind] }}</span>
                <div class="flex min-w-0 flex-col">
                  <span class="text-xs font-bold text-muted">{{ e.milestoneTitle }}</span>
                  <a v-if="e.url" :href="e.url" target="_blank" rel="noopener noreferrer" class="truncate font-semibold text-violet underline-offset-2 hover:underline">{{ e.url.replace(/^https?:\/\//, '') }}</a>
                  <a v-else-if="e.hasFile" :href="`/api/evidence/${e.id}/file`" target="_blank" rel="noopener" class="truncate font-semibold text-violet underline-offset-2 hover:underline" :data-testid="`evidence-file-${e.id}`">{{ e.fileName }}</a>
                  <span v-else-if="e.fileName" class="truncate font-semibold">{{ e.fileName }}</span>
                  <span v-if="e.body" class="line-clamp-2">“{{ e.body }}”</span>
                  <span v-if="e.learned" class="line-clamp-2 italic text-muted">{{ e.learned }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <TrackCompleteSheet
          :open="sheetOpen"
          :milestone="sheetMilestone"
          :remaining-after="remainingAfter"
          @close="sheetOpen = false"
          @submit="completeFromSheet"
        />

        <UiConfirm
          :open="confirmDelete"
          :title="$t('track.deleteConfirm')"
          :confirm-label="$t('track.deleteYes')"
          :busy="busy"
          @confirm="remove"
          @cancel="confirmDelete = false"
        />
        <UiConfirm
          :open="!!pendingReopen"
          :title="$t('track.reopenTitle')"
          :body="$t('track.reopenBody')"
          :confirm-label="$t('track.reopenYes')"
          @confirm="confirmReopen"
          @cancel="pendingReopen = null"
        />
      </template>
    </UiState>
  </div>
</template>

<script setup lang="ts">
import type { CompleteInput, Milestone, TrackDetail } from '~~/shared/types/domain'
import { forecastFinish, percent } from '~~/shared/utils/progress'

const route = useRoute()
const repo = useRepo()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const id = computed(() => String(route.params.id))

const { data: track, error, refresh } = useAsyncData(() => `track-${id.value}`, () => repo.getTrack(id.value), { server: false, watch: [id], deep: true })
useHead({ title: () => track.value?.title ?? t('nav.myTracks') })

const bursts = reactive<Record<string, number>>({})
const busy = ref(false)
const actionError = ref(false)
const confirmDelete = ref(false)
const pendingReopen = ref<Milestone | null>(null)
const sheetOpen = ref(false)
const sheetMilestone = ref<Milestone | null>(null)

const all = computed(() => track.value?.phases.flatMap(p => p.milestones) ?? [])
const next = computed(() => all.value.find(m => !m.completedAt) ?? null)
const pct = computed(() => percent(track.value?.done ?? 0, track.value?.total ?? 0))
const remainingAfter = computed(() => Math.max(0, all.value.filter(m => !m.completedAt).length - 1))

const forecastText = computed(() => {
  const tr = track.value
  if (!tr) return ''
  const eta = forecastFinish(all.value.map(m => ({ completed_at: m.completedAt })), new Date())
  if (!eta) return ''
  const date = formatDate(eta, locale.value, { day: 'numeric', month: 'long' })
  const late = tr.targetDate && eta.getTime() > new Date(`${tr.targetDate}T23:59:59`).getTime()
  return t(late ? 'track.forecastLate' : 'track.forecast', { date })
})

const evidenceIcon = { link: '🔗', note: '✎', file: '📎', certificate: '🏅' } as const
const evidenceTone = { link: 'bg-sky-soft text-sky', note: 'bg-sun-soft text-sun', file: 'bg-violet-soft text-violet', certificate: 'bg-mint-soft text-mint' } as const

function recount(tr: TrackDetail) {
  const ms = tr.phases.flatMap(p => p.milestones)
  tr.done = ms.filter(m => m.completedAt).length
  tr.nextMilestoneTitle = ms.find(m => !m.completedAt)?.title ?? null
}

function onToggle(m: Milestone) {
  // Reopening deletes evidence and time spent: ask first when there is something to lose.
  if (m.completedAt && (m.evidenceCount > 0 || m.timeSpentMinutes)) {
    pendingReopen.value = m
    return
  }
  return applyToggle(m)
}

function confirmReopen() {
  const m = pendingReopen.value
  pendingReopen.value = null
  if (m) applyToggle(m)
}

async function applyToggle(m: Milestone) {
  const tr = track.value
  if (!tr || busy.value) return
  const target = tr.phases.flatMap(p => p.milestones).find(x => x.id === m.id)
  if (!target) return
  actionError.value = false
  const wasDone = !!target.completedAt
  const prev = target.completedAt
  busy.value = true
  // Optimistic update, rolled back on failure.
  target.completedAt = wasDone ? null : new Date().toISOString()
  recount(tr)
  if (!wasDone) bursts[m.id] = (bursts[m.id] ?? 0) + 1
  try {
    if (wasDone) await repo.reopenMilestone(m.id)
    else await repo.completeMilestone(m.id)
  }
  catch {
    target.completedAt = prev
    recount(tr)
    actionError.value = true
    busy.value = false
    return
  }
  // The write went through; a failed reload is not a failed toggle. Stay busy until it settles.
  await refresh()
  busy.value = false
}

function openSheet(m: Milestone) {
  sheetMilestone.value = m
  sheetOpen.value = true
}

async function completeFromSheet(input: CompleteInput, done: (ok: boolean) => void) {
  const m = sheetMilestone.value
  if (!m) return done(false)
  try {
    await repo.completeMilestone(m.id, input)
    bursts[m.id] = (bursts[m.id] ?? 0) + 1
    done(true)
    await refresh()
  }
  catch {
    done(false)
  }
}

async function guarded(fn: () => Promise<void>) {
  busy.value = true
  actionError.value = false
  try {
    await fn()
  }
  catch {
    actionError.value = true
  }
  finally {
    busy.value = false
  }
}

function toggleFollow() {
  const tr = track.value
  if (!tr) return
  return guarded(async () => {
    await repo.setFollowing(tr.id, !tr.isFollowing)
    await refresh()
  })
}

function remove() {
  const tr = track.value
  if (!tr) return
  return guarded(async () => {
    await repo.deleteTrack(tr.id)
    confirmDelete.value = false
    await navigateTo(localePath('/tracks'))
  })
}
</script>
