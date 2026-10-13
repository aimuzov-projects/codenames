import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'

import {
	isRoomCode,
	normalizeRoomCode,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_LENGTH,
	type RelayIn,
	type RelayOut,
} from '#shared/relay-protocol.ts'

/**
 * Game message relay: "star" rooms around the host, no game logic on the server.
 * It exists precisely so that a device that fell asleep can rejoin the game on its own: WebRTC over
 * QR signaling can't do that (a new handshake needs a person with a camera).
 *
 * Run: node src/backend/server.ts (Node executes TypeScript without a build).
 */

const PORT = Number(process.env.PORT ?? 8787)
/** How long a room lives without its host: it may have fallen asleep or restarted the app. */
const ROOM_TTL_MS = 30 * 60 * 1000
const SWEEP_MS = 60 * 1000
const MAX_ROOMS = 500
const MAX_MESSAGE_BYTES = 256 * 1024

type Room = {
	code: string
	host: WebSocket | null
	guests: Map<string, WebSocket>
	/** When the room was left without its host (0 means the host is present). */
	orphanedAt: number
}

const rooms = new Map<string, Room>()
/** Reverse index: from the socket we know whom to detach on close. */
const membership = new WeakMap<WebSocket, { room: Room; id: string | null }>()

function send(ws: WebSocket, msg: RelayOut) {
	if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

function newRoomCode(): string {
	for (;;) {
		const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
		const code = [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('')
		if (!rooms.has(code)) return code
	}
}

function openRoom(ws: WebSocket, requested?: string) {
	const code = requested && isRoomCode(requested) ? requested : newRoomCode()
	const existing = rooms.get(code)
	// You can return to your room as long as nobody has taken it: a room has exactly one host.
	if (existing && existing.host !== null && existing.host !== ws) {
		send(ws, { t: 'error', reason: 'room-taken' })
		return
	}
	if (!existing && rooms.size >= MAX_ROOMS) {
		send(ws, { t: 'error', reason: 'room-taken' })
		return
	}
	const room = existing ?? { code, host: null, guests: new Map(), orphanedAt: 0 }
	room.host = ws
	room.orphanedAt = 0
	rooms.set(code, room)
	membership.set(ws, { room, id: null })
	send(ws, { t: 'hosting', code })
	// Guests waiting for the host to come back will introduce themselves again (see wsRelay: open → hello).
	for (const [id, guest] of room.guests) {
		send(guest, { t: 'host-online', online: true })
		send(ws, { t: 'peer', id, online: true })
	}
}

function joinRoom(ws: WebSocket, rawCode: string, id: string) {
	const room = rooms.get(normalizeRoomCode(rawCode))
	if (!room) {
		send(ws, { t: 'error', reason: 'no-room' })
		return
	}
	// A reconnect of the same player evicts their previous socket.
	room.guests.get(id)?.close()
	room.guests.set(id, ws)
	membership.set(ws, { room, id })
	send(ws, { t: 'joined', code: room.code })
	send(ws, { t: 'host-online', online: room.host !== null })
	if (room.host) send(room.host, { t: 'peer', id, online: true })
}

function route(ws: WebSocket, msg: Extract<RelayIn, { t: 'to' }>) {
	const seat = membership.get(ws)
	if (!seat) return
	const { room, id } = seat
	if (id === null) {
		// The sender is the host: address a specific guest.
		const guest = msg.to === undefined ? undefined : room.guests.get(msg.to)
		if (guest) send(guest, { t: 'from', from: 'host', data: msg.data })
	} else if (room.host) {
		send(room.host, { t: 'from', from: id, data: msg.data })
	}
}

function leave(ws: WebSocket) {
	const seat = membership.get(ws)
	if (!seat) return
	membership.delete(ws)
	const { room, id } = seat
	if (id === null) {
		if (room.host !== ws) return
		room.host = null
		room.orphanedAt = Date.now()
		for (const guest of room.guests.values()) send(guest, { t: 'host-online', online: false })
		return
	}
	// The socket may already be evicted by the same player's reconnect, then there's nothing to touch.
	if (room.guests.get(id) !== ws) return
	room.guests.delete(id)
	if (room.host) send(room.host, { t: 'peer', id, online: false })
}

// Plain HTTP is needed for liveness checks (docker healthcheck, waiting for the server in e2e).
const http = createServer((_req, res) => {
	res.writeHead(200, { 'content-type': 'text/plain' })
	res.end(`ok ${rooms.size}`)
})
const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES })

wss.on('connection', (ws) => {
	let alive = true
	ws.on('pong', () => (alive = true))

	// Half-dead sockets (a sleeping phone) stay silent and never close, so we kill them by ping.
	const ping = setInterval(() => {
		if (!alive) {
			ws.terminate()
			return
		}
		alive = false
		ws.ping()
	}, 25_000)

	ws.on('message', (raw) => {
		let msg: RelayIn
		try {
			msg = JSON.parse(String(raw)) as RelayIn
		} catch {
			send(ws, { t: 'error', reason: 'bad-message' })
			return
		}
		switch (msg.t) {
			case 'host':
				openRoom(ws, msg.code)
				break
			case 'join':
				joinRoom(ws, msg.code, msg.id)
				break
			case 'to':
				route(ws, msg)
				break
			default:
				send(ws, { t: 'error', reason: 'bad-message' })
		}
	})

	ws.on('close', () => {
		clearInterval(ping)
		leave(ws)
	})
	ws.on('error', () => ws.terminate())
})

// Rooms the host has left for long are removed, otherwise codes pile up forever.
setInterval(() => {
	const now = Date.now()
	for (const [code, room] of rooms) {
		if (room.host === null && now - room.orphanedAt > ROOM_TTL_MS) {
			for (const guest of room.guests.values()) guest.close()
			rooms.delete(code)
		}
	}
}, SWEEP_MS).unref()

http.listen(PORT, () => console.log(`codenames relay: ws://0.0.0.0:${PORT}`))
