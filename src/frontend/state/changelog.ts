import { LATEST } from '#frontend/data/changelog.ts'
import { atom, computed } from '#frontend/lib/atom.ts'

const KEY = 'codenames.changelog.seen'

/** Last version whose changelog the player has opened. */
function loadSeen(): string {
	try {
		return localStorage.getItem(KEY) ?? ''
	} catch {
		return ''
	}
}

const seenVersionAtom = atom(loadSeen())

/**
 * Whether there are unseen changes: the latest release version differs from the one
 * whose changelog the player already opened. On first launch (empty) we also count it as unseen,
 * to invite a look at "what the app can do".
 */
export const hasUnseenChangelogAtom = computed([seenVersionAtom], () => seenVersionAtom() !== LATEST.version)

/** Marks the changelog as seen, which turns off the "new" badge. Called when the screen opens. */
export function markChangelogSeen() {
	if (seenVersionAtom() === LATEST.version) return
	seenVersionAtom.set(LATEST.version)
	try {
		localStorage.setItem(KEY, LATEST.version)
	} catch {
		// private mode / no access: the badge will just show up again
	}
}
