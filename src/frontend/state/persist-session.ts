import type { GameState, RedactedState, Role, Team } from '#frontend/game/index.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

/**
 * Network game snapshot in localStorage. Needed because iOS unloads the PWA from memory:
 * without it, an app woken up an hour later would open on the main screen, and the game
 * (the canonical state on the host, the last view on a guest) would vanish without a trace.
 *
 * The storage has no logic of its own: net.ts builds and restores the snapshot, here it's only format and I/O.
 */
const KEY = 'codenames.session'
const VERSION = 1
/** We don't revive a game older than a day: that's no longer "back to the game", it's garbage. */
const TTL_MS = 24 * 60 * 60 * 1000

export type SessionSnapshot = {
	v: number
	ts: number
	mode: 'host' | 'guest'
	/** What we played over: 'qr' (WebRTC on one network) or 'relay' (a room on the server). */
	transport: 'qr' | 'relay'
	/** Relay room code: the host takes the room back with it, and the guest gets in without extra questions. */
	code: string
	id: string
	name: string
	team: Team
	role: Role
	roster: PlayerInfo[]
	started: boolean
	/** Canonical game state, host only. */
	game: GameState | null
	/** Last view sent by the host, guest only. */
	view: RedactedState | null
}

export function loadSnapshot(): SessionSnapshot | null {
	try {
		const raw = localStorage.getItem(KEY)

		if (!raw) return null

		const snap = JSON.parse(raw) as SessionSnapshot

		if (snap.v !== VERSION || Date.now() - snap.ts > TTL_MS) {
			clearSnapshot()

			return null
		}

		return snap
	} catch {
		return null
	}
}

/** Saves the snapshot and returns it in full (with version and timestamp). */
export function saveSnapshot(snap: Omit<SessionSnapshot, 'v' | 'ts'>): SessionSnapshot {
	const full: SessionSnapshot = { ...snap, v: VERSION, ts: Date.now() }

	try {
		localStorage.setItem(KEY, JSON.stringify(full))
	} catch {
		// private mode / quota exceeded: we'll live through a restart without restore
	}

	return full
}

export function clearSnapshot() {
	try {
		localStorage.removeItem(KEY)
	} catch {
		// see above
	}
}
