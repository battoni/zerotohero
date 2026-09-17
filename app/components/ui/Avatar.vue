<template>
  <img
    v-if="profile.avatarUrl"
    :src="profile.avatarUrl"
    :alt="name"
    class="shrink-0 rounded-full object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
    referrerpolicy="no-referrer"
  >
  <span
    v-else
    class="grid shrink-0 place-items-center rounded-full font-extrabold text-on-color"
    :class="bg"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }"
    :title="name"
    aria-hidden="true"
  >{{ initials(name) }}</span>
</template>

<script setup lang="ts">
import type { Profile } from '~~/shared/types/domain'

const props = withDefaults(defineProps<{ profile: Pick<Profile, 'handle' | 'displayName' | 'avatarUrl'>, size?: number }>(), { size: 32 })
const name = computed(() => props.profile.displayName || props.profile.handle)
const bg = computed(() => ({ violet: 'bg-violet', sky: 'bg-sky', mint: 'bg-mint', coral: 'bg-coral', sun: 'bg-sun' })[toneFor(props.profile.handle)])
</script>
