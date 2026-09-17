<template>
  <div class="flex flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('editor.newTitle') }}</h1>
    <TrackEditor :cancel-to="localePath('/tracks')" :draft-key="draftKey" :template-id="templateId" @save="create" />
  </div>
</template>

<script setup lang="ts">
import type { TrackInput } from '~~/shared/types/domain'

const repo = useRepo()
const route = useRoute()
const localePath = useLocalePath()
const templateId = computed(() => (typeof route.query.from === 'string' ? route.query.from : undefined))
const draftKey = computed(() => `new:${templateId.value ?? ''}`)
const { t } = useI18n()
useHead({ title: () => t('editor.newTitle') })

async function create(input: TrackInput, done: (ok: boolean) => void, sourceId: string | null) {
  try {
    // From a template: copy it (so it counts as a use and keeps its provenance), then apply the edits.
    let id: string
    if (sourceId) {
      id = await repo.copyTrack(sourceId)
      await repo.updateTrack(id, input)
    }
    else {
      id = await repo.createTrack(input)
    }
    done(true)
    await navigateTo(localePath(`/tracks/${id}`))
  }
  catch {
    done(false)
  }
}
</script>
