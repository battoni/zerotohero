<template>
  <div class="flex flex-col gap-5 pt-4">
    <h1 class="text-3xl font-black">{{ $t('friends.title') }}</h1>
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section class="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-soft">
        <h2 class="text-lg font-extrabold">{{ $t('friends.feed') }}</h2>
        <UiState :pending="feed === undefined && !feedError" :error="feedError" @retry="refreshFeed">
          <p v-if="!feed?.length" class="text-muted">{{ $t('friends.feedEmpty') }}</p>
          <div v-else class="flex flex-col gap-4" data-testid="feed">
            <FriendsFeedItem v-for="item in feed" :key="item.id" :item="item" :me-id="me?.id" @kudos="toggleKudos" />
          </div>
        </UiState>
      </section>

      <aside class="flex flex-col gap-4">
        <div v-if="lists?.incoming.length" class="flex flex-col gap-3 rounded-card bg-sun-soft p-4" data-testid="friend-requests">
          <h2 class="font-extrabold">{{ $t('friends.requests') }}</h2>
          <div v-for="p in lists.incoming" :key="p.id" class="flex flex-wrap items-center gap-2">
            <UiAvatar :profile="p" />
            <NuxtLink :to="localePath(`/u/${p.handle}`)" class="flex-1 font-semibold">{{ p.displayName || p.handle }}</NuxtLink>
            <UiBtn size="sm" variant="mint" :data-testid="`accept-${p.handle}`" @click="respond(p.id, true)">{{ $t('friends.accept') }}</UiBtn>
            <UiBtn size="sm" variant="ghost" @click="respond(p.id, false)">{{ $t('friends.decline') }}</UiBtn>
          </div>
        </div>

        <div class="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-soft">
          <h2 class="font-extrabold">{{ $t('friends.find') }}</h2>
          <input id="friends-search" v-model="query" type="search" class="field" :placeholder="$t('friends.findPlaceholder')" data-testid="friends-search">
          <p v-if="query.trim() && results && !results.length" class="text-[13px] text-muted">{{ $t('friends.noResults') }}</p>
          <div v-for="p in results" :key="p.id" class="flex items-center gap-2">
            <UiAvatar :profile="p" />
            <NuxtLink :to="localePath(`/u/${p.handle}`)" class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-semibold">{{ p.displayName || p.handle }}</span>
              <span class="text-xs text-muted">@{{ p.handle }}</span>
            </NuxtLink>
            <span v-if="stateOf(p.id) === 'friends'" class="text-xs font-bold text-mint">{{ $t('profile.friends') }}</span>
            <span v-else-if="stateOf(p.id) === 'outgoing'" class="text-xs font-bold text-muted">{{ $t('friends.sent') }}</span>
            <UiBtn v-else size="sm" variant="primary" :data-testid="`add-${p.handle}`" @click="add(p.id)">{{ stateOf(p.id) === 'incoming' ? $t('friends.accept') : $t('friends.add') }}</UiBtn>
          </div>
        </div>

        <div class="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-soft" data-testid="friends-list">
          <h2 class="font-extrabold">{{ $t('friends.list') }}</h2>
          <p v-if="!lists?.friends.length" class="text-[13px] text-muted">{{ $t('friends.listEmpty') }}</p>
          <div v-for="p in lists?.friends" :key="p.id" class="group flex items-center gap-2">
            <UiAvatar :profile="p" />
            <NuxtLink :to="localePath(`/u/${p.handle}`)" class="flex-1 font-semibold">{{ p.displayName || p.handle }}</NuxtLink>
            <UiBtn size="sm" variant="ghost" class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" @click="removeFriend(p.id)">{{ $t('friends.remove') }}</UiBtn>
          </div>
          <p v-for="p in lists?.outgoing" :key="p.id" class="text-[13px] text-muted">{{ $t('friends.pending', { name: p.displayName || p.handle }) }}</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem, FriendState, Profile } from '~~/shared/types/domain'

const repo = useRepo()
const { me, loadMe } = useSession()
const localePath = useLocalePath()
const { t } = useI18n()
useHead({ title: () => t('friends.title') })

const { data: feed, error: feedError, refresh: refreshFeed } = useAsyncData('feed', async () => {
  await loadMe()
  return repo.feed()
}, { server: false, deep: true })
const { data: lists, refresh: refreshLists } = useAsyncData('friend-lists', () => repo.friends(), { server: false })

const query = ref('')
const results = ref<Profile[] | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = q.trim() ? await repo.searchProfiles(q) : null
  }, 250)
})

function stateOf(id: string): FriendState {
  const l = lists.value
  if (!l) return 'none'
  if (l.friends.some(p => p.id === id)) return 'friends'
  if (l.outgoing.some(p => p.id === id)) return 'outgoing'
  if (l.incoming.some(p => p.id === id)) return 'incoming'
  return 'none'
}

async function toggleKudos(item: FeedItem) {
  const on = !item.kudosByMe
  item.kudosByMe = on
  item.kudosCount += on ? 1 : -1
  try {
    await repo.setKudos(item.id, on)
  }
  catch {
    item.kudosByMe = !on
    item.kudosCount += on ? -1 : 1
  }
}

async function add(id: string) {
  await repo.requestFriend(id)
  await Promise.all([refreshLists(), refreshFeed()])
}

async function respond(id: string, accept: boolean) {
  await repo.respondFriend(id, accept)
  await Promise.all([refreshLists(), refreshFeed()])
}

async function removeFriend(id: string) {
  await repo.removeFriend(id)
  await Promise.all([refreshLists(), refreshFeed()])
}
</script>
