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
/** Turn length in seconds; 0 means no timer. */
export const timerSecondsAtom = atom(saved.timer ?? 0)

export const TIMER_OPTIONS = [0, 60, 120, 180] as const

/** Word size on a card (font-size). */
export const CARD_WORD_SIZES = ['11px', '13px', '15px', '17px'] as const
export type CardWordSize = (typeof CARD_WORD_SIZES)[number]

const DEFAULT_CARD_WORD_SIZE: CardWordSize = '13px'

function normalizeSize(v: unknown): CardWordSize {
	return (CARD_WORD_SIZES as readonly string[]).includes(v as string) ? (v as CardWordSize) : DEFAULT_CARD_WORD_SIZE
}

export const cardWordSizeAtom = atom<CardWordSize>(normalizeSize(saved.cardWordSize))

/** Hide words on revealed cards, replacing them with an icon for the card type. */
export const hideRevealedWordsAtom = atom(saved.hideRevealedWords ?? false)

/** Keep the screen on during a game: device sleep drops the link to the host (see useWakeLock). */
export const keepAwakeAtom = atom(saved.keepAwake ?? true)

/** Applies the word size to <html> via a CSS variable. */
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
		// private mode / no access: settings just won't be saved
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
