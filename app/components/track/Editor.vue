<template>
  <form class="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]" novalidate data-testid="track-editor" @submit.prevent="save">
    <!-- How to start (first on phones too, before anything gets typed) -->
    <div v-if="isNew" class="grid gap-2.5 lg:col-span-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]" role="group" :aria-label="$t('editor.startLabel')">
      <button
        v-for="s in STARTS" :key="s" type="button" :aria-pressed="start === s"
        class="flex flex-col gap-1 rounded-2xl p-3.5 text-left"
        :class="start === s ? 'bg-violet-soft shadow-[inset_0_0_0_2px_var(--violet)]' : 'bg-surface-2'"
        :data-testid="`editor-start-${s}`"
        @click="start = s"
      >
        <b class="font-extrabold">{{ $t(`editor.start.${s}`) }}</b>
        <span class="text-[13px] text-muted">{{ $t(`editor.start.${s}Hint`) }}</span>
      </button>
    </div>
    <!-- Paste -->
    <div v-if="isNew && start === 'paste'" class="flex flex-col lg:col-span-2 gap-2.5 rounded-2xl bg-surface-2 p-4">
      <label class="label">
        {{ $t('editor.pasteLabel') }}
        <textarea id="editor-paste" v-model="pasted" rows="8" class="field num bg-surface!" :placeholder="$t('editor.pastePlaceholder')" aria-describedby="editor-paste-hint" data-testid="editor-paste" />
      </label>
      <p id="editor-paste-hint" class="text-[13px] text-muted">{{ $t('editor.pasteHint') }}</p>
      <div v-if="parsed" class="flex flex-col gap-1.5 text-[13px]">
        <span class="font-semibold">{{ $t('editor.pastePreview', {
          phases: $t('editor.pastePhases', { count: parsed.track.phases.length }, parsed.track.phases.length),
          milestones: $t('editor.pasteMilestones', { count: parsedCount }, parsedCount),
        }) }}</span>
        <template v-if="parsed.errors.length">
          <span class="font-bold text-coral">{{ $t('editor.pasteErrors') }}</span>
          <ul class="list-inside list-disc text-coral" data-testid="editor-paste-errors">
            <li v-for="(e, i) in parsed.errors.slice(0, 6)" :key="i">{{ $t(`editor.pasteError.${e.code}`, { line: e.line, value: e.value ?? '' }) }}</li>
          </ul>
        </template>
      </div>
      <div>
        <UiBtn size="sm" variant="primary" :disabled="!parsedCount" data-testid="editor-paste-apply" @click="applyPaste">{{ $t('editor.pasteApply') }}</UiBtn>
      </div>
    </div>

    <!-- Template -->
    <div v-if="isNew && start === 'template'" class="flex flex-col lg:col-span-2 gap-2 rounded-2xl bg-surface-2 p-4">
      <span class="text-[13px] font-bold text-muted">{{ $t('editor.templatePick') }}</span>
      <p v-if="templatesPending" class="text-[13px] text-muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!templates?.length" class="text-[13px] text-muted">{{ $t('editor.templateEmpty') }}</p>
      <div v-for="tpl in templates" :key="tpl.id" class="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
        <span class="flex min-w-0 items-center gap-2 font-semibold">
          <span aria-hidden="true">{{ tpl.emoji }}</span>
          <span class="truncate">{{ tpl.title }}</span>
          <span class="text-xs text-muted">· {{ tpl.owner.displayName || tpl.owner.handle }}</span>
        </span>
        <UiBtn size="sm" :data-testid="`editor-template-${tpl.id}`" @click="applyTemplate(tpl.id)">{{ $t('editor.templateUse') }}</UiBtn>
      </div>
    </div>

    <!-- Identity -->
    <div class="flex flex-col gap-3.5">
      <div class="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[20px] p-5 text-white transition-[background]" :class="`cover-${form.color}`" data-testid="editor-cover">
        <span class="absolute -bottom-12 -right-8 size-40 rounded-full bg-white/15" aria-hidden="true" />
        <span class="relative text-4xl" aria-hidden="true">{{ form.emoji || '🎯' }}</span>
        <h2 class="relative text-2xl font-black">{{ form.title || $t('editor.namePlaceholder') }}</h2>
      </div>

      <label class="label">
        {{ $t('editor.name') }}
        <input id="editor-title" v-model="form.title" class="field" maxlength="80" :placeholder="$t('editor.namePlaceholder')" data-testid="editor-title">
      </label>
      <label class="label">
        {{ $t('editor.goal') }}
        <textarea id="editor-goal" v-model="goal" class="field" rows="2" maxlength="280" :placeholder="$t('editor.goalPlaceholder')" data-testid="editor-goal" />
      </label>
      <div class="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
        <label class="label">
          {{ $t('editor.emoji') }}
          <input id="editor-emoji" v-model="form.emoji" class="field text-center text-lg" maxlength="8" data-testid="editor-emoji">
        </label>
        <label class="label">
          {{ $t('editor.date') }}
          <input id="editor-date" v-model="targetDate" type="date" class="field num" data-testid="editor-date">
        </label>
      </div>
      <div class="flex flex-wrap gap-1.5" :aria-label="$t('editor.emoji')">
        <button
          v-for="e in EMOJIS" :key="e" type="button"
          class="grid size-9 place-items-center rounded-xl text-lg hover:bg-surface-2"
          :class="form.emoji === e ? 'bg-surface-2' : ''"
          :aria-pressed="form.emoji === e" @click="form.emoji = e"
        >
          {{ e }}
        </button>
      </div>
      <div class="label">
        {{ $t('editor.color') }}
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in TRACK_COLORS" :key="c" type="button"
            class="size-9 rounded-full border-[3px]" :class="[`cover-${c}`, form.color === c ? 'border-ink' : 'border-transparent']"
            :aria-label="$t(`editor.colors.${c}`)" :aria-pressed="form.color === c" :data-testid="`editor-color-${c}`"
            @click="form.color = c"
          />
        </div>
      </div>
      <div class="label">
        {{ $t('editor.visibility') }}
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('editor.visibility')">
          <button
            v-for="v in TRACK_VISIBILITIES" :key="v" type="button" :aria-pressed="form.visibility === v"
            class="rounded-full px-3 py-1.5 text-[13px] font-semibold"
            :class="form.visibility === v ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
            :data-testid="`editor-visibility-${v}`"
            @click="form.visibility = v"
          >
            {{ $t(`track.visibility.${v}`) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Structure -->
    <div class="flex flex-col gap-3.5">

      <div class="flex items-center justify-between">
        <h2 class="text-lg font-extrabold">{{ $t('editor.phases') }}</h2>
        <span class="text-[13px] text-muted">{{ $t('editor.milestoneCount', { count: totalMilestones }, totalMilestones) }}</span>
      </div>

      <TransitionGroup tag="div" name="list" class="flex flex-col gap-3">
        <div v-for="(phase, pi) in form.phases" :key="phase.key" class="flex flex-col gap-2 rounded-2xl bg-surface p-3.5 shadow-soft" :data-testid="`editor-phase-${pi}`">
          <div class="flex items-center gap-2">
            <input
              :id="`phase-${phase.key}`" v-model="phase.title" class="field font-extrabold" maxlength="60"
              :aria-label="$t('editor.phaseTitle')" :placeholder="$t('editor.phaseTitle')" :data-testid="`editor-phase-title-${pi}`"
            >
            <UiIconBtn :id="`up-${phase.key}`" :label="$t('editor.moveUp')" :disabled="pi === 0" @click="move(form.phases, pi, -1, phase.key)">↑</UiIconBtn>
            <UiIconBtn :id="`down-${phase.key}`" :label="$t('editor.moveDown')" :disabled="pi === form.phases.length - 1" @click="move(form.phases, pi, 1, phase.key)">↓</UiIconBtn>
            <UiIconBtn :label="$t('editor.remove')" :disabled="form.phases.length === 1" @click="form.phases.splice(pi, 1)">✕</UiIconBtn>
          </div>
          <div v-for="(m, mi) in phase.milestones" :key="m.key" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-surface-2 p-2 sm:grid-cols-[minmax(0,1fr)_110px_140px_auto]" :data-testid="`editor-milestone-${pi}-${mi}`">
            <div class="flex items-center gap-2">
              <span v-if="m.completedAt" class="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[11px] font-bold text-on-color">{{ $t('editor.completedKept') }}</span>
              <input :id="`ms-${m.key}`" v-model="m.title" class="field bg-surface!" maxlength="140" :aria-label="$t('editor.milestoneTitle')" :placeholder="$t('editor.milestoneTitle')" :data-testid="`editor-milestone-title-${pi}-${mi}`">
            </div>
            <input :id="`tag-${m.key}`" v-model="m.tag" class="field bg-surface! max-sm:order-3" maxlength="24" :aria-label="$t('editor.tag')" :placeholder="`#${$t('editor.tag').toLowerCase()}`">
            <input :id="`due-${m.key}`" v-model="m.dueDate" type="date" class="field num bg-surface! max-sm:order-4" :aria-label="$t('editor.due')">
            <div class="flex gap-1 max-sm:row-start-1 max-sm:col-start-2">
              <UiIconBtn :id="`up-${m.key}`" :label="$t('editor.moveUp')" :disabled="mi === 0" @click="move(phase.milestones, mi, -1, m.key)">↑</UiIconBtn>
              <UiIconBtn :id="`down-${m.key}`" :label="$t('editor.moveDown')" :disabled="mi === phase.milestones.length - 1" @click="move(phase.milestones, mi, 1, m.key)">↓</UiIconBtn>
              <UiIconBtn :label="$t('editor.remove')" :data-testid="`editor-remove-${pi}-${mi}`" @click="removeMilestone(phase, mi)">✕</UiIconBtn>
            </div>
          </div>
          <button type="button" class="self-start rounded-full px-3 py-1.5 text-sm font-bold text-violet hover:bg-violet-soft" :data-testid="`editor-add-milestone-${pi}`" @click="addMilestone(phase)">
            + {{ $t('editor.addMilestone') }}
          </button>
        </div>
      </TransitionGroup>
      <button type="button" class="self-start rounded-full px-3 py-1.5 text-sm font-bold text-violet hover:bg-violet-soft" data-testid="editor-add-phase" @click="addPhase">
        + {{ $t('editor.addPhase') }}
      </button>

      <p v-if="errorKey" class="rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral" role="alert" data-testid="editor-error">{{ $t(errorKey) }}</p>
      <div class="flex flex-wrap gap-2">
        <UiBtn type="submit" variant="primary" :disabled="saving" data-testid="editor-save">
          {{ saving ? $t('editor.saving') : (isNew ? $t('editor.save') : $t('editor.update')) }}
        </UiBtn>
        <UiBtn variant="ghost" data-testid="editor-cancel" @click="cancel">{{ $t('track.cancel') }}</UiBtn>
      </div>
    </div>

    <UiConfirm
      :open="!!pendingRemove"
      :title="$t('editor.removeDoneTitle')"
      :body="pendingRemove ? $t('editor.removeDoneBody', { title: pendingRemove.phase.milestones[pendingRemove.index]?.title ?? '' }) : ''"
      :confirm-label="$t('editor.removeDoneYes')"
      :cancel-label="$t('editor.keep')"
      @confirm="confirmRemove"
      @cancel="pendingRemove = null"
    />
  </form>
</template>

<script setup lang="ts">
import type { TrackInput } from '~~/shared/types/domain'
import { TRACK_COLORS, TRACK_VISIBILITIES, parseTrackList, type ParseResult, type ParsedTrack, type TrackColor, type TrackVisibility } from '~~/shared/utils/track-list'

const props = defineProps<{ initial?: TrackInput, cancelTo: string, draftKey: string, templateId?: string }>()
const emit = defineEmits<{ save: [input: TrackInput, done: (ok: boolean) => void, sourceId: string | null] }>()
const { t } = useI18n()
const repo = useRepo()

const EMOJIS = ['🎯', '🚀', '🤖', '☁️', '🐍', '🟩', '🗣️', '🎨', '📚', '🧠', '🏅', '💼']
const STARTS = ['blank', 'template', 'paste'] as const

interface EditMilestone { key: number, id?: string, title: string, tag: string, dueDate: string, completedAt: string | null }
interface EditPhase { key: number, id?: string, title: string, milestones: EditMilestone[] }

let keySeq = 0
const nextKey = () => ++keySeq
const isNew = computed(() => !props.initial)

interface Draft {
  form: { title: string, emoji: string, color: TrackColor, visibility: TrackVisibility, phases: EditPhase[] }
  goal: string
  targetDate: string
  sourceId: string | null
}

// Unsaved edits live in shared state, so switching language (a new route) keeps them.
const draft = useState<Draft | null>(`track-draft:${props.draftKey}`, () => null)
const saved = draft.value
if (saved) keySeq = Math.max(0, ...saved.form.phases.flatMap(p => [p.key, ...p.milestones.map(m => m.key)]))

const form = reactive<Draft['form']>(saved?.form ?? {
  title: props.initial?.title ?? '',
  emoji: props.initial?.emoji ?? '🎯',
  color: props.initial?.color ?? 'violet',
  visibility: props.initial?.visibility ?? 'private',
  phases: toEditPhases(props.initial?.phases ?? [{ title: t('editor.defaultPhase'), milestones: [{ title: '', tag: null, dueDate: null }] }]),
})
const goal = ref(saved?.goal ?? props.initial?.goal ?? '')
const targetDate = ref(saved?.targetDate ?? props.initial?.targetDate ?? '')
const sourceId = ref<string | null>(saved?.sourceId ?? null)
const start = ref<typeof STARTS[number]>(sourceId.value ? 'template' : 'blank')

watch([form, goal, targetDate, sourceId], () => {
  draft.value = { form: JSON.parse(JSON.stringify(form)), goal: goal.value, targetDate: targetDate.value, sourceId: sourceId.value }
}, { deep: true })

function discardDraft() {
  draft.value = null
}

// Leaving for another page drops the draft; switching language (same path, other prefix) keeps it.
const stripLocale = (path: string) => path.replace(/^\/pt-BR(?=\/|$)/, '') || '/'
onBeforeRouteLeave((to, from) => {
  if (stripLocale(to.path) !== stripLocale(from.path)) discardDraft()
})

async function cancel() {
  discardDraft()
  await navigateTo(props.cancelTo)
}
const pasted = ref('')
const errorKey = ref('')
const saving = ref(false)

function toEditPhases(phases: TrackInput['phases']): EditPhase[] {
  return phases.map(p => ({
    key: nextKey(),
    id: p.id,
    title: p.title,
    milestones: p.milestones.map(m => ({ key: nextKey(), id: m.id, title: m.title, tag: m.tag ?? '', dueDate: m.dueDate ?? '', completedAt: m.completedAt ?? null })),
  }))
}

const totalMilestones = computed(() => form.phases.reduce((n, p) => n + p.milestones.filter(m => m.title.trim()).length, 0))

function move<T>(list: T[], index: number, delta: number, key: number) {
  const to = index + delta
  if (to < 0 || to >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(to, 0, item!)
  // Keep focus on the moved row: same arrow if it is still usable, otherwise the other one.
  nextTick(() => {
    const same = document.getElementById(`${delta < 0 ? 'up' : 'down'}-${key}`) as HTMLButtonElement | null
    const other = document.getElementById(`${delta < 0 ? 'down' : 'up'}-${key}`) as HTMLButtonElement | null
    ;(same && !same.disabled ? same : other)?.focus()
  })
}

const pendingRemove = ref<{ phase: EditPhase, index: number } | null>(null)

function removeMilestone(phase: EditPhase, index: number) {
  if (phase.milestones[index]?.completedAt) pendingRemove.value = { phase, index }
  else phase.milestones.splice(index, 1)
}

function confirmRemove() {
  const p = pendingRemove.value
  if (p) p.phase.milestones.splice(p.index, 1)
  pendingRemove.value = null
}

function addMilestone(phase: EditPhase) {
  const m: EditMilestone = { key: nextKey(), title: '', tag: '', dueDate: '', completedAt: null }
  phase.milestones.push(m)
  nextTick(() => document.getElementById(`ms-${m.key}`)?.focus())
}

function addPhase() {
  const p: EditPhase = { key: nextKey(), title: '', milestones: [{ key: nextKey(), title: '', tag: '', dueDate: '', completedAt: null }] }
  form.phases.push(p)
  nextTick(() => document.getElementById(`phase-${p.key}`)?.focus())
}

// Paste a list
const parsed = computed<ParseResult | null>(() => (pasted.value.trim() ? parseTrackList(pasted.value) : null))
const parsedCount = computed(() => parsed.value?.track.phases.reduce((n, p) => n + p.milestones.length, 0) ?? 0)

function fillFrom(track: ParsedTrack) {
  if (track.title) form.title = track.title
  if (track.goal) goal.value = track.goal
  if (track.emoji) form.emoji = track.emoji
  if (track.color) form.color = track.color
  if (track.visibility) form.visibility = track.visibility
  if (track.due) targetDate.value = track.due
  form.phases = toEditPhases(track.phases.map(p => ({
    title: p.title ?? t('editor.defaultPhase'),
    milestones: p.milestones.map(m => ({
      title: m.title,
      tag: m.tag,
      dueDate: m.done ? null : m.date,
      completedAt: m.done ? (m.date ? new Date(`${m.date}T12:00:00`).toISOString() : new Date().toISOString()) : null,
    })),
  })))
}

function applyPaste() {
  if (!parsed.value) return
  sourceId.value = null
  fillFrom(parsed.value.track)
}

// Arriving from Explore (?from=…): prefill from that template once, unless a draft already exists.
onMounted(() => {
  if (props.templateId && !saved) {
    start.value = 'template'
    applyTemplate(props.templateId)
  }
})

// Start from a template
const { data: templates, pending: templatesPending, execute: loadTemplates } = useAsyncData('editor-templates', () => repo.explore({ filter: 'popular' }), {
  server: false,
  immediate: false,
})
watch(start, (s) => {
  if (s === 'template' && !templates.value) loadTemplates()
})

async function applyTemplate(id: string) {
  errorKey.value = ''
  const tpl = await repo.getTrack(id).catch(() => null)
  if (!tpl) {
    errorKey.value = 'editor.templateMissing'
    start.value = 'template'
    return
  }
  sourceId.value = id
  form.title = tpl.title
  goal.value = tpl.goal ?? ''
  form.emoji = tpl.emoji
  form.color = tpl.color
  form.phases = toEditPhases(tpl.phases.map(p => ({
    title: p.title,
    milestones: p.milestones.map(m => ({ title: m.title, tag: m.tag, dueDate: null })),
  })))
}

function save() {
  errorKey.value = ''
  // A pasted list that wasn't applied yet is what the user means to save.
  if (isNew.value && start.value === 'paste' && parsedCount.value) {
    applyPaste()
    pasted.value = ''
  }
  if (!form.title.trim()) {
    errorKey.value = 'editor.errorTitle'
    document.getElementById('editor-title')?.focus()
    return
  }
  // Blank milestone rows are ignored rather than blocking the save.
  const phases = form.phases.map(p => ({ ...p, milestones: p.milestones.filter(m => m.title.trim()) }))
  if (!phases.length) {
    errorKey.value = 'editor.errorEmpty'
    return
  }
  if (phases.some(p => !p.title.trim())) {
    errorKey.value = 'editor.errorPhases'
    return
  }
  if (phases.some(p => !p.milestones.length)) {
    errorKey.value = 'editor.errorPhaseEmpty'
    return
  }
  const input: TrackInput = {
    title: form.title.trim(),
    goal: goal.value.trim() || null,
    emoji: form.emoji.trim() || '🎯',
    color: form.color,
    targetDate: targetDate.value || null,
    visibility: form.visibility,
    phases: phases.map(p => ({
      ...(p.id ? { id: p.id } : {}),
      title: p.title.trim(),
      milestones: p.milestones.map(m => ({
        ...(m.id ? { id: m.id } : {}),
        title: m.title.trim(),
        tag: m.tag.trim().replace(/^#/, '') || null,
        dueDate: m.dueDate || null,
        ...(!m.id && m.completedAt ? { completedAt: m.completedAt } : {}),
      })),
    })),
  }
  saving.value = true
  emit('save', input, (ok) => {
    saving.value = false
    if (ok) discardDraft()
    else errorKey.value = 'editor.errorSave'
  }, sourceId.value)
}
</script>

<style scoped>
.list-move, .list-enter-active, .list-leave-active { transition: all .2s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(6px); }
</style>
