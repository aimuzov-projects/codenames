import { atom } from '#frontend/lib/atom.ts'

const KEY = 'codenames.settings'

type Persisted = {
	sound: boolean
	timer: number
	cardWordSize: string
	hideRevealedWords: boolean
	keepAwake: boolean
}

function load(): Partial<Persisted> {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Persisted>
	} catch {
		return {}
	}
}

const saved = load()

export const soundEnabledAtom = atom(saved.sound ?? true)
/** Длительность хода в секундах; 0 — без таймера. */
export const timerSecondsAtom = atom(saved.timer ?? 0)

/** Варианты длительности хода на экране настроек, в секундах. */
export const TIMER_OPTIONS = [0, 60, 120, 180] as const

/** Размер слова на карте (font-size). */
export const CARD_WORD_SIZES = ['11px', '13px', '15px', '17px'] as const
export type CardWordSize = (typeof CARD_WORD_SIZES)[number]

const DEFAULT_CARD_WORD_SIZE: CardWordSize = '13px'

// В localStorage может лежать что угодно (например, размер, которого уже нет в списке),
// поэтому всё незнакомое сводим к размеру по умолчанию.
function normalizeSize(v: unknown): CardWordSize {
	return (CARD_WORD_SIZES as readonly string[]).includes(v as string) ? (v as CardWordSize) : DEFAULT_CARD_WORD_SIZE
}

export const cardWordSizeAtom = atom<CardWordSize>(normalizeSize(saved.cardWordSize))

/** Прятать слова на открытых картах, заменяя их иконкой по типу. */
export const hideRevealedWordsAtom = atom(saved.hideRevealedWords ?? false)

/** Держать экран включённым в игре: сон устройства рвёт связь с хостом (см. useWakeLock). */
export const keepAwakeAtom = atom(saved.keepAwake ?? true)

/** Применяет размер слова к <html> через CSS-переменную. */
export function applyCardWordSize(size: CardWordSize = cardWordSizeAtom()): void {
	document.documentElement.style.setProperty('--card-word-size', size)
}

function persist() {
	try {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				sound: soundEnabledAtom(),
				timer: timerSecondsAtom(),
				cardWordSize: cardWordSizeAtom(),
				hideRevealedWords: hideRevealedWordsAtom(),
				keepAwake: keepAwakeAtom(),
			}),
		)
	} catch {
		// приватный режим / нет доступа — настройки просто не сохранятся
	}
}

export function setSound(v: boolean) {
	soundEnabledAtom.set(v)
	persist()
}

export function setTimer(v: number) {
	timerSecondsAtom.set(v)
	persist()
}

export function setCardWordSize(v: CardWordSize) {
	cardWordSizeAtom.set(v)
	persist()
	applyCardWordSize(v)
}

export function setHideRevealedWords(v: boolean) {
	hideRevealedWordsAtom.set(v)
	persist()
}

export function setKeepAwake(v: boolean) {
	keepAwakeAtom.set(v)
	persist()
}
