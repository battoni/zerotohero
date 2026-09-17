<template>
  <div class="flex flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('editor.editTitle') }}</h1>
    <UiState :pending="initial === undefined && !error" :error="error" :rows="4" @retry="refresh">
      <div v-if="!initial" class="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-soft">
        <p class="font-semibold">{{ $t('track.notFound') }}</p>
        <UiBtn :to="localePath('/tracks')">{{ $t('track.back') }}</UiBtn>
      </div>
      <TrackEditor v-else :key="id" :initial="initial" :cancel-to="localePath(`/tracks/${id}`)" @save="update" />
    </UiState>
  </div>
</template>

<script setup lang="ts">
import type { TrackInput } from '~~/shared/types/domain'

const route = useRoute()
const repo = useRepo()
const localePath = useLocalePath()
const { t } = useI18n()
const id = computed(() => String(route.params.id))
useHead({ title: () => t('editor.editTitle') })

const { data: initial, error, refresh } = useAsyncData(() => `edit-${id.value}`, async (): Promise<TrackInput | null> => {
  const tr = await repo.getTrack(id.value)
  if (!tr || !tr.isOwner) return null
  return {
    title: tr.title,
    goal: tr.goal,
    emoji: tr.emoji,
    color: tr.color,
    targetDate: tr.targetDate,
    visibility: tr.visibility,
    phases: tr.phases.map(p => ({
      id: p.id,
      title: p.title,
      milestones: p.milestones.map(m => ({ id: m.id, title: m.title, tag: m.tag, dueDate: m.dueDate, completedAt: m.completedAt })),
    })),
  }
}, { server: false, watch: [id] })

async function update(input: TrackInput, done: (ok: boolean) => void) {
  try {
    await repo.updateTrack(id.value, input)
    done(true)
    await navigateTo(localePath(`/tracks/${id.value}`))
  }
  catch {
    done(false)
  }
}
</script>
