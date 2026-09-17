<template>
  <div class="flex flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('editor.newTitle') }}</h1>
    <TrackEditor :cancel-to="localePath('/tracks')" @save="create" />
  </div>
</template>

<script setup lang="ts">
import type { TrackInput } from '~~/shared/types/domain'

const repo = useRepo()
const localePath = useLocalePath()
const { t } = useI18n()
useHead({ title: () => t('editor.newTitle') })

async function create(input: TrackInput, done: (ok: boolean) => void) {
  try {
    const id = await repo.createTrack(input)
    done(true)
    await navigateTo(localePath(`/tracks/${id}`))
  }
  catch {
    done(false)
  }
}
</script>
