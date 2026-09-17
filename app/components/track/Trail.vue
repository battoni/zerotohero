<template>
  <div class="flex flex-col" data-testid="trail">
    <div v-for="phase in phases" :key="phase.id" class="flex flex-col">
      <h2 class="flex items-center gap-2.5 pb-2.5 pt-1.5 text-[15px] font-extrabold">
        <span>{{ phase.title }}</span>
        <span class="num text-xs font-bold text-muted">{{ $t('track.phaseCount', { done: doneIn(phase), total: phase.milestones.length }) }}</span>
      </h2>
      <div
        v-for="m in phase.milestones"
        :key="m.id"
        class="relative grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 pb-3.5"
        :data-testid="`milestone-${m.id}`"
        :data-done="m.completedAt ? 'true' : 'false'"
      >
        <span
          v-if="m.id !== lastId"
          class="absolute bottom-0 left-[15.5px] top-[34px] w-[3px] rounded"
          :class="m.completedAt ? 'bg-mint' : 'bg-surface-2'"
          aria-hidden="true"
        />
        <component
          :is="editable ? 'button' : 'span'"
          :type="editable ? 'button' : undefined"
          class="relative grid size-[34px] place-items-center rounded-full border-[3px] transition-[transform,background,border-color]"
          :class="[
            m.completedAt ? 'border-mint bg-mint' : 'border-ring bg-surface',
            m.id === currentId ? 'border-violet! shadow-[0_0_0_5px_var(--violet-soft)]' : '',
            editable ? 'cursor-pointer hover:scale-110 hover:border-mint' : '',
          ]"
          :aria-pressed="editable ? (m.completedAt ? 'true' : 'false') : undefined"
          :aria-label="editable ? $t('track.toggleDone', { title: m.title }) : undefined"
          :data-testid="editable ? `toggle-${m.id}` : undefined"
          @click="editable && emit('toggle', m)"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-4 transition-opacity" :class="m.completedAt ? 'opacity-100' : 'opacity-0'" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="var(--on-color)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <UiConfetti :trigger="bursts[m.id] ?? 0" />
        </component>
        <div class="flex flex-col gap-1 pt-1.5">
          <b class="font-bold" :class="m.completedAt ? 'text-muted line-through decoration-mint decoration-2' : ''">{{ m.title }}</b>
          <div v-if="m.tag" class="flex flex-wrap gap-1.5">
            <UiChip :tone="toneFor(m.tag)">{{ m.tag }}</UiChip>
          </div>
        </div>
        <span class="num whitespace-nowrap pt-2 text-xs text-muted">
          <template v-if="m.completedAt">{{ $t('track.doneOn', { date: formatDate(m.completedAt, locale) }) }}</template>
          <template v-else-if="m.dueDate">{{ $t('track.due', { date: formatDate(m.dueDate, locale) }) }}</template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Milestone, Phase } from '~~/shared/types/domain'

const props = defineProps<{ phases: Phase[], editable: boolean, bursts: Record<string, number> }>()
const emit = defineEmits<{ toggle: [milestone: Milestone] }>()
const { locale } = useI18n()

const all = computed(() => props.phases.flatMap(p => p.milestones))
const lastId = computed(() => all.value.at(-1)?.id)
const currentId = computed(() => all.value.find(m => !m.completedAt)?.id)
const doneIn = (p: Phase) => p.milestones.filter(m => m.completedAt).length
</script>
