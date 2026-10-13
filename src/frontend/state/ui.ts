import { deleteCustomPack, loadCustomPacks, upsertCustomPack } from '#frontend/data/custom-packs.ts'
import { BUILTIN_PACKS, DEFAULT_PACK_IDS, mergeWords, parseWordList, type WordPack } from '#frontend/data/packs.ts'
import type { Team } from '#frontend/game/index.ts'
import { atom, computed } from '#frontend/lib/atom.ts'

export type Screen =
	| 'home'
	| 'play'
	| 'lobby'
	| 'dicts'
	| 'rules'
	| 'board'
	| 'packs'
	| 'host'
	| 'host-add'
	| 'join'
	| 'settings'
	| 'stats'
	| 'changelog'

export const screenAtom = atom<Screen>('home')

/** Stack of visited screens for the "back" button. */
const historyAtom = atom<Screen[]>([])

/** Direction of the last transition, for the animation (`forward` / `back`). */
export const navDirectionAtom = atom<'forward' | 'back'>('forward')

/** Whether the clue input overlay (spymaster composer) is open. */
export const composerOpenAtom = atom<boolean>(false)

/**
 * Why the join screen is open: 'new' is joining a new game, 'reconnect' is getting back into your game
 * after a drop (name and seat are already there, the screen shows QR right away and keeps the session on exit).
 */
export const joinModeAtom = atom<'new' | 'reconnect'>('new')

/** Opens the join screen in the given mode. */
export function goToJoin(mode: 'new' | 'reconnect' = 'new') {
	joinModeAtom.set(mode)
	goTo('join')
}

export function goTo(screen: Screen) {
	if (screen === screenAtom()) return
	historyAtom.set([...historyAtom(), screenAtom()])
	navDirectionAtom.set('forward')
	screenAtom.set(screen)
}

/** Team the stats screen is filtered by (null means both teams). */
export const statsTeamAtom = atom<Team | null>(null)

/** Opens stats: filtered by team (tap on a score chip)
 *  or unfiltered (header icon / button on the final screen). */
export function goToStats(team: Team | null = null) {
	statsTeamAtom.set(team)
	goTo('stats')
}

/** Back to the previous screen (or home if there's no history). */
export function goBack() {
	const h = historyAtom()
	const prev = h[h.length - 1] ?? 'home'
	historyAtom.set(h.slice(0, -1))
	navDirectionAtom.set('back')
	screenAtom.set(prev)
}

/** Custom packs loaded from IndexedDB. */
export const customPacksAtom = atom<WordPack[]>([])

/** All available packs: built-in + custom. */
export const allPacksAtom = computed<WordPack[]>([customPacksAtom], () => [...BUILTIN_PACKS, ...customPacksAtom()])

/** Packs selected for the game (by default, a starter mix of three topics). */
export const selectedPackIdsAtom = atom<string[]>([...DEFAULT_PACK_IDS])

export function togglePack(id: string) {
	const ids = selectedPackIdsAtom()
	selectedPackIdsAtom.set(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
}

/** Words from the selected packs (merged, no duplicates). */
export const selectedWordsAtom = computed<string[]>([allPacksAtom, selectedPackIdsAtom], () => {
	const selected = allPacksAtom().filter((p) => selectedPackIdsAtom().includes(p.id))
	return mergeWords(selected)
})

/** Loads custom packs from IndexedDB (called on startup). */
export async function hydrateCustomPacks() {
	const packs = await loadCustomPacks()
	customPacksAtom.set(packs)
}

/** Creates a custom pack from free-form text and selects it. */
export async function addCustomPack(title: string, text: string) {
	const words = parseWordList(text)
	const pack = await upsertCustomPack({ title, words })
	customPacksAtom.set([...customPacksAtom(), pack])
	if (!selectedPackIdsAtom().includes(pack.id)) {
		selectedPackIdsAtom.set([...selectedPackIdsAtom(), pack.id])
	}
	return pack
}

/** Deletes a custom pack. */
export async function removeCustomPack(id: string) {
	await deleteCustomPack(id)
	customPacksAtom.set(customPacksAtom().filter((p) => p.id !== id))
	selectedPackIdsAtom.set(selectedPackIdsAtom().filter((x) => x !== id))
}
