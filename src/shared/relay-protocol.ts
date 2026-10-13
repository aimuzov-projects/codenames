/**
 * WS relay message envelope. The server is a dumb router: it only knows the rooms, who is the host
 * in each and who the guests are, and doesn't parse `data` (game messages), so its type is set by the client.
 *
 * The format is shared by the server (src/backend/server.ts) and the client (transport/ws-relay.ts), so
 * it lives in src/shared: this way the sides don't drift apart.
 */

/** Guest→server and host→server. */
export type RelayIn<Data = unknown> =
	/** The host opens a room; `code` is for returning to its own after a drop or restart. */
	| { t: 'host'; code?: string }
	/** A guest joins a room under its device id. */
	| { t: 'join'; code: string; id: string }
	/** Forward a payload: the host specifies the guest id, a guest always sends to the host. */
	| { t: 'to'; to?: string; data: Data }

/** Server→client. */
export type RelayOut<Data = unknown> =
	/** Room opened (to the host). */
	| { t: 'hosting'; code: string }
	/** Joined (to the guest). */
	| { t: 'joined'; code: string }
	/** Payload from the peer: a guest gets it from 'host'. */
	| { t: 'from'; from: string; data: Data }
	/** To the host: a guest appeared or disappeared. */
	| { t: 'peer'; id: string; online: boolean }
	/** To a guest: whether the host is online (it may have fallen asleep or restarted). */
	| { t: 'host-online'; online: boolean }
	| { t: 'error'; reason: 'no-room' | 'room-taken' | 'bad-message' }

/** Room code alphabet, without characters that get mixed up when dictating and typing (0/O, 1/I). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6

export function normalizeRoomCode(input: string): string {
	return input
		.trim()
		.toUpperCase()
		.replaceAll(/[^A-Z2-9]/g, '')
}

export function isRoomCode(code: string): boolean {
	return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
}
