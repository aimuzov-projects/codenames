import type { GameEvent, RedactedState, Role, Team } from '#frontend/game/index.ts'

/** Public player info (for the lobby). */
export type PlayerInfo = {
	id: string
	name: string
	team: Team
	role: Role
	connected: boolean
}

/**
 * Host → client messages.
 * `ping` is a heartbeat: a webview frozen by sleep often doesn't send close, and silence in the channel
 * turns out to be the only sign of a drop (see heartbeat in net.ts).
 */
export type HostMessage =
	| { t: 'welcome'; youId: string }
	| { t: 'lobby'; players: PlayerInfo[]; started: boolean }
	| { t: 'state'; state: RedactedState }
	| { t: 'ping' }

/** Client → host messages. */
export type ClientMessage =
	// id is a stable device identifier: the host recognizes a returning player by it.
	| { t: 'hello'; id: string; name: string }
	| { t: 'setup'; team: Team; role: Role }
	| { t: 'intent'; event: GameEvent }
	| { t: 'ping' }
