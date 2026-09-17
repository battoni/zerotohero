<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-[20px] bg-surface-2 transition-transform focus-within:-translate-y-0.5 hover:-translate-y-0.5"
    :data-testid="`track-card-${track.id}`"
  >
    <div class="relative flex min-h-[112px] items-start justify-between gap-3 overflow-hidden p-4 text-white" :class="`cover-${track.color}`">
      <span class="absolute -bottom-10 -right-8 size-32 rounded-full bg-white/15" aria-hidden="true" />
      <div class="relative min-w-0">
        <span class="text-3xl leading-none" aria-hidden="true">{{ track.emoji }}</span>
        <h3 :id="titleId" class="mt-2.5 text-lg font-extrabold leading-tight">{{ track.title }}</h3>
      </div>
      <UiProgressRing v-if="showProgress" :value="pct" light class="relative" />
    </div>
    <div class="flex flex-1 flex-col gap-1.5 p-4">
      <slot>
        <template v-if="track.total && track.done === track.total">
          <span class="text-xs font-bold text-mint">{{ $t('track.allDone') }}</span>
        </template>
        <template v-else-if="track.nextMilestoneTitle">
          <span class="text-xs font-bold text-muted">{{ $t('track.next') }}</span>
          <span class="font-bold">{{ track.nextMilestoneTitle }}</span>
        </template>
        <span class="text-[13px] text-muted">
          <span class="num">{{ $t('track.progress', { done: track.done, total: track.total }) }}</span>
          ·
          {{ track.targetDate ? $t('track.until', { date: formatDate(track.targetDate, locale) }) : $t('track.noDate') }}
        </span>
      </slot>
    </div>
    <!-- Covers the card so all of it is clickable; controls in the slot sit above it (z-[2]). -->
    <NuxtLink
      :to="localePath(`/tracks/${track.id}`)"
      class="absolute inset-0 z-[1] rounded-[20px] focus-visible:outline-3 focus-visible:outline-offset-2"
      :aria-labelledby="titleId"
      :data-testid="`track-link-${track.id}`"
    />
  </article>
</template>

<script setup lang="ts">
import type { TrackSummary } from '~~/shared/types/domain'
import { percent } from '~~/shared/utils/progress'

const props = withDefaults(defineProps<{ track: TrackSummary, showProgress?: boolean }>(), { showProgress: true })
const localePath = useLocalePath()
const { locale } = useI18n()
const titleId = useId()
const pct = computed(() => percent(props.track.done, props.track.total))
</script>
