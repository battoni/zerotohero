<template>
  <div class="flex items-start gap-3 text-sm" :data-testid="`feed-${item.id}`">
    <NuxtLink :to="localePath(`/u/${item.actor.handle}`)" tabindex="-1" aria-hidden="true"><UiAvatar :profile="item.actor" :size="36" /></NuxtLink>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p>
        <NuxtLink :to="localePath(`/u/${item.actor.handle}`)" class="font-bold hover:underline">{{ isMe ? $t('friends.you') : (item.actor.displayName || item.actor.handle) }}</NuxtLink>
        {{ ' ' }}
        <i18n-t :keypath="`friends.activity.${item.type}`" scope="global" tag="span">
          <template #milestone><b>“{{ item.milestoneTitle }}”</b></template>
          <template #track>
            <NuxtLink :to="localePath(`/tracks/${item.track.id}`)" class="font-semibold italic hover:underline">{{ item.track.emoji }} {{ item.track.title }}</NuxtLink>
          </template>
        </i18n-t>
      </p>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{{ relativeTime(item.createdAt, locale) }}</span>
        <template v-if="item.kudosCount">· <span>{{ $t('friends.cheerCount', { count: item.kudosCount }, item.kudosCount) }}</span></template>
        <button
          v-if="!isMe"
          type="button"
          class="rounded-full px-2 py-1 font-bold"
          :class="item.kudosByMe ? 'bg-coral-soft text-coral' : 'text-coral hover:bg-coral-soft'"
          :data-on="item.kudosByMe"
          :data-testid="`kudos-${item.id}`"
          @click="emit('kudos', item)"
        >
          ♥ {{ item.kudosByMe ? $t('friends.cheered') : $t('friends.cheer') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '~~/shared/types/domain'

const props = defineProps<{ item: FeedItem, meId: string | undefined }>()
const emit = defineEmits<{ kudos: [item: FeedItem] }>()
const localePath = useLocalePath()
const { locale } = useI18n()
const isMe = computed(() => props.item.actor.id === props.meId)
</script>
