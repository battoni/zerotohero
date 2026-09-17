<template>
  <UiSheet :open="open" :title="celebrating ? celebrateHeading : $t('complete.title')" :hide-title="!!celebrating" @close="onClose">
    <div v-if="!celebrating && milestone" class="flex flex-col gap-4" data-testid="complete-form">
      <p class="text-lg font-black leading-snug">{{ milestone.title }}</p>

      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-bold text-muted">{{ $t('complete.evidence') }}</span>
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('complete.evidenceLabel')">
          <button
            v-for="k in kinds"
            :key="k"
            type="button"
            :aria-pressed="kind === k"
            class="rounded-full px-3 py-1.5 text-[13px] font-semibold"
            :class="kind === k ? 'bg-violet text-on-color' : 'bg-surface-2 text-muted'"
            :data-testid="`evidence-kind-${k}`"
            @click="kind = k"
          >
            {{ $t(`complete.kinds.${k}`) }}
          </button>
        </div>
      </div>

      <label v-if="kind === 'link' || kind === 'certificate'" class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('complete.url') }}
        <input id="complete-url" v-model="url" :aria-invalid="invalidField === 'complete-url' || undefined" :aria-describedby="invalidField === 'complete-url' ? 'complete-error' : undefined" type="url" inputmode="url" :placeholder="$t('complete.urlPlaceholder')" class="field" data-testid="evidence-url">
      </label>
      <label v-if="kind === 'note'" class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('complete.note') }}
        <textarea id="complete-note" v-model="note" :aria-invalid="invalidField === 'complete-note' || undefined" :aria-describedby="invalidField === 'complete-note' ? 'complete-error' : undefined" rows="3" class="field" data-testid="evidence-note" />
      </label>
      <label v-if="kind === 'file' || kind === 'certificate'" class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('complete.file') }}
        <input id="complete-file" :aria-invalid="invalidField === 'complete-file' || undefined" :aria-describedby="invalidField === 'complete-file' ? 'complete-error' : undefined" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="field" data-testid="evidence-file" @change="onFile">
        <span v-if="mode === 'demo'" class="font-medium">{{ $t('complete.fileDemo') }}</span>
      </label>
      <label v-if="kind !== 'none'" class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        {{ $t('complete.learned') }}
        <textarea id="complete-learned" v-model="learned" rows="2" class="field" data-testid="evidence-learned" />
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          {{ $t('complete.date') }}
          <input id="complete-date" v-model="date" :aria-invalid="invalidField === 'complete-date' || undefined" :aria-describedby="invalidField === 'complete-date' ? 'complete-error' : undefined" type="date" :max="todayIso" class="field num" data-testid="complete-date">
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          {{ $t('complete.time') }}
          <input id="complete-time" v-model.number="minutes" :aria-invalid="invalidField === 'complete-time' || undefined" :aria-describedby="invalidField === 'complete-time' ? 'complete-error' : undefined" type="number" min="0" step="5" max="100000" class="field num" data-testid="complete-time">
        </label>
      </div>

      <p v-if="errorKey" id="complete-error" class="rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral" role="alert">{{ $t(errorKey) }}</p>

      <div class="flex flex-wrap gap-2">
        <UiBtn variant="mint" :disabled="saving" data-testid="complete-submit" @click="submit">
          {{ saving ? $t('complete.saving') : $t('complete.submit') }}
        </UiBtn>
        <UiBtn variant="ghost" @click="onClose">{{ $t('track.cancel') }}</UiBtn>
      </div>
    </div>

    <div v-else-if="celebrating" class="relative -m-2 flex flex-col gap-3 overflow-hidden rounded-[22px] cover-mint p-7 text-white" data-testid="celebrate">
      <span class="grid size-16 place-items-center rounded-full bg-white/25">
        <svg viewBox="0 0 24 24" fill="none" class="size-8" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <UiConfetti :trigger="celebrating" :radius="90" :count="18" />
      </span>
      <h3 class="text-3xl font-black" aria-hidden="true">{{ celebrateHeading }}</h3>
      <p>{{ remaining === 0 ? $t('complete.celebrateDone') : $t('complete.celebrateLeft', { count: remaining }, remaining) }}</p>
      <div>
        <UiBtn id="celebrate-continue" variant="ink" data-testid="celebrate-close" @click="onClose">{{ remaining === 0 ? $t('complete.finish') : $t('complete.close') }}</UiBtn>
      </div>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
import type { CompleteInput, EvidenceKind, Milestone } from '~~/shared/types/domain'
import { completionAt, isFutureDate, localIsoDate } from '~~/shared/utils/dates'

const props = defineProps<{ open: boolean, milestone: Milestone | null, remainingAfter: number }>()
const emit = defineEmits<{ close: [], submit: [input: CompleteInput, done: (ok: boolean) => void] }>()
const mode = useDataMode()
const { t } = useI18n()

type Kind = EvidenceKind | 'none'
const kinds: Kind[] = ['link', 'note', 'file', 'certificate', 'none']
// Local calendar date (toISOString would give tomorrow in the evening west of UTC).
const localIso = localIsoDate
// Recomputed on every open: a tab left open past midnight must not stay on yesterday.
const todayIso = ref(localIso(new Date()))

const kind = ref<Kind>('link')
const url = ref('')
const note = ref('')
const learned = ref('')
const file = ref<File | null>(null)
const date = ref(todayIso.value)
const minutes = ref<number | ''>('')
const errorKey = ref('')
const FIELD_FOR: Record<string, string> = {
  'complete.errorUrl': 'complete-url',
  'complete.errorNote': 'complete-note',
  'complete.errorFile': 'complete-file',
  'complete.errorMinutes': 'complete-time',
  'complete.errorDate': 'complete-date',
}
const invalidField = computed(() => FIELD_FOR[errorKey.value] ?? '')
const saving = ref(false)
const celebrating = ref(0)
const remaining = ref(0)
const celebrateHeading = computed(() => (remaining.value === 0 ? t('track.allDone') : t('complete.celebrateTitle')))

watch(() => props.open, (open) => {
  if (!open) return
  todayIso.value = localIso(new Date())
  kind.value = 'link'
  url.value = note.value = learned.value = ''
  file.value = null
  date.value = todayIso.value
  minutes.value = ''
  errorKey.value = ''
  celebrating.value = 0
})

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function validate(): string {
  // `max` on the input isn't enforced for typed dates.
  if (date.value && isFutureDate(date.value)) return 'complete.errorDate'
  if (minutes.value !== '' && !(Number.isInteger(minutes.value) && minutes.value >= 0 && minutes.value <= 100_000)) return 'complete.errorMinutes'
  if (kind.value === 'link' && !/^https?:\/\/\S+$/i.test(url.value.trim())) return 'complete.errorUrl'
  if (kind.value === 'certificate' && !file.value && !/^https?:\/\/\S+$/i.test(url.value.trim())) return 'complete.errorUrl'
  if (kind.value === 'note' && !note.value.trim()) return 'complete.errorNote'
  if (kind.value === 'file' && !file.value) return 'complete.errorFile'
  const f = file.value
  if (f && (f.size > 10 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type))) return 'complete.errorFile'
  return ''
}

function submit() {
  errorKey.value = validate()
  if (errorKey.value) {
    nextTick(() => document.getElementById(invalidField.value)?.focus())
    return
  }
  const input: CompleteInput = {
    completedAt: date.value && date.value !== todayIso.value ? completionAt(date.value) : undefined,
    timeSpentMinutes: minutes.value === '' ? null : Number(minutes.value),
    evidence: kind.value === 'none'
      ? null
      : {
          kind: kind.value,
          url: url.value.trim() || null,
          body: note.value.trim() || null,
          learned: learned.value.trim() || null,
          file: kind.value === 'file' || kind.value === 'certificate' ? file.value : null,
        },
  }
  saving.value = true
  emit('submit', input, (ok) => {
    saving.value = false
    if (!ok) {
      errorKey.value = 'complete.errorSave'
      return
    }
    remaining.value = props.remainingAfter
    celebrating.value += 1
    nextTick(() => document.getElementById('celebrate-continue')?.focus())
  })
}

function onClose() {
  emit('close')
}
</script>
