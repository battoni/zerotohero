<template>
  <div class="flex flex-col gap-5 pt-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-black">{{ $t('explore.title') }}</h1>
      <label class="w-full sm:w-80">
        <span class="sr-only">{{ $t('explore.search') }}</span>
        <input id="explore-search" v-model="search" type="search" class="field bg-surface! shadow-soft" :placeholder="$t('explore.searchPlaceholder')" data-testid="explore-search">
      </label>
    </div>
    <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('explore.filtersLabel')">
      <button
        v-for="f in FILTERS" :key="f" type="button" :aria-pressed="filter === f"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
        :class="filter === f ? 'bg-ink text-surface' : 'bg-surface-2 text-muted'"
        :data-testid="`explore-filter-${f}`"
        @click="filter = f"
      >
        {{ $t(`explore.filters.${f}`) }}
      </button>
    </div>

    <UiState :pending="data === undefined && !error" :error="error" @retry="refresh">
      <p v-if="!data?.length" class="text-muted" data-testid="explore-empty">{{ $t('explore.empty') }}</p>
      <div v-else class="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]" data-testid="explore-list">
        <TrackCard v-for="tr in data" :key="tr.id" :track="tr" :show-progress="false">
          <span class="text-[13px] text-muted">{{ $t('explore.milestones', { count: tr.total }, tr.total) }}</span>
          <div class="mt-1 flex items-center justify-between gap-2">
            <span class="flex items-center gap-2 text-[13px] font-semibold">
              <UiAvatar :profile="tr.owner" :size="24" />
              {{ tr.ownerId === me?.id ? $t('explore.yours') : (tr.owner.displayName || tr.owner.handle) }}
            </span>
            <span class="text-[13px] text-muted">{{ $t('explore.usedBy', { count: tr.copiesCount }, tr.copiesCount) }}</span>
          </div>
          <UiBtn
            v-if="tr.ownerId !== me?.id"
            variant="primary" size="sm" class="relative z-[2] mt-2 self-start"
            :to="localePath(`/tracks/new?from=${tr.id}`)"
            :data-testid="`explore-use-${tr.id}`"
          >
            {{ $t('explore.use') }}
          </UiBtn>
        </TrackCard>
      </div>
    </UiState>
  </div>
</template>

<script setup lang="ts">
import type { ExploreFilter } from '~~/shared/types/domain'

const repo = useRepo()
const { me, loadMe } = useSession()
const localePath = useLocalePath()
const { t } = useI18n()
useHead({ title: () => t('explore.title') })

const FILTERS: ExploreFilter[] = ['popular', 'recent', 'friends']
const search = ref('')
const debounced = ref('')
const filter = ref<ExploreFilter>('popular')

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debounced.value = v), 250)
})

const { data, error, refresh } = useAsyncData('explore', async () => {
  await loadMe()
  return repo.explore({ search: debounced.value, filter: filter.value })
}, { server: false, watch: [debounced, filter] })

</script>
