import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'
import type { GuestTransport, HostTransport } from '#frontend/transport/types.ts'
import type { RelayIn as Envelope, RelayOut as EnvelopeOut } from '#shared/relay-protocol.ts'

type RelayIn = Envelope<ClientMessage | HostMessage>
type RelayOut = EnvelopeOut<ClientMessage | HostMessage>

/**
 * Transport over the WS relay. The main difference from QR/WebRTC: a broken channel heals itself.
 * The socket reconnects with backoff, the guest rejoins the room under the same device id,
 * and the host takes its room back. That's exactly what lets people return to a game after
 * the phone sleeps, without making them point a camera at someone else's screen again.
 */

const RETRY_MIN_MS = 500
const RETRY_MAX_MS = 5000

type Fatal = 'no-room' | 'room-taken'

/** Socket with auto-reconnect: lives until close(), comes back up by itself after a drop. */
class ReconnectingSocket {
	private ws: WebSocket | null = null
	private timer: ReturnType<typeof setTimeout> | null = null
	private delay = RETRY_MIN_MS
	private stopped = false
	private readonly url: string
	private readonly onOpen: () => void
	private readonly onMessage: (msg: RelayOut) => void
	private readonly onDown: () => void

	constructor(url: string, onOpen: () => void, onMessage: (msg: RelayOut) => void, onDown: () => void) {
		this.url = url
		this.onOpen = onOpen
		this.onMessage = onMessage
		this.onDown = onDown
		this.connect()
		// Coming back from background and the network reappearing are the best moments to retry: no point
		// waiting for the next backoff step when the person is already looking at the screen.
		globalThis.addEventListener('online', this.wake)
		document.addEventListener('visibilitychange', this.wake)
	}

	private wake = () => {
		if (this.stopped || document.visibilityState !== 'visible') return

		if (this.ws?.readyState === WebSocket.OPEN) return

		this.delay = RETRY_MIN_MS
		this.connect()
	}

	private connect() {
		if (this.stopped) return

		if (this.timer !== null) {
			clearTimeout(this.timer)
			this.timer = null
		}

		this.ws?.close()
		const ws = new WebSocket(this.url)

		this.ws = ws

		ws.onopen = () => {
			this.delay = RETRY_MIN_MS
			this.onOpen()
		}

		ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as RelayOut)

		ws.onclose = () => {
			if (this.ws !== ws) return // already replaced by a newer attempt

			this.onDown()
			this.scheduleRetry()
		}

		ws.onerror = () => ws.close()
	}

	private scheduleRetry() {
		if (this.stopped || this.timer !== null) return

		this.timer = setTimeout(() => {
			this.timer = null
			this.connect()
		}, this.delay)

		this.delay = Math.min(this.delay * 2, RETRY_MAX_MS)
	}

	get open() {
		return this.ws?.readyState === WebSocket.OPEN
	}

	send(msg: RelayIn) {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
	}

	close() {
		this.stopped = true

		if (this.timer !== null) clearTimeout(this.timer)

		globalThis.removeEventListener('online', this.wake)
		document.removeEventListener('visibilitychange', this.wake)
		this.ws?.close()
		this.ws = null
	}
}

/** Host side: a room on the relay, guests are addressed by their device id. */
export class WsHostTransport implements HostTransport {
	private socket: ReconnectingSocket
	private code: string | null = null
	private guests = new Set<string>()
	private messageCb: (connId: string, msg: ClientMessage) => void = () => {}
	private disconnectCb: (connId: string) => void = () => {}
	private readonly onCode: (code: string) => void
	private readonly onFatal: (reason: Fatal) => void

	constructor(
		url: string,
		/** Previous room code: to get back into the same room after an app restart. */
		code: string | null,
		onCode: (code: string) => void,
		onFatal: (reason: Fatal) => void = () => {},
	) {
		this.code = code
		this.onCode = onCode
		this.onFatal = onFatal

		this.socket = new ReconnectingSocket(
			url,
			// Same code after a drop: guests stay in the room and wait for the host to return.
			() => this.socket.send({ t: 'host', code: this.code ?? undefined }),
			(msg) => this.handle(msg),
			() => {},
		)
	}

	private handle(msg: RelayOut) {
		switch (msg.t) {
			case 'hosting':
				this.code = msg.code
				this.onCode(msg.code)
				break
			case 'peer':
				if (msg.online) this.guests.add(msg.id)
				else if (this.guests.delete(msg.id)) this.disconnectCb(msg.id)

				break
			case 'from':
				this.guests.add(msg.from)
				this.messageCb(msg.from, msg.data as ClientMessage)
				break
			case 'error':
				if (msg.reason !== 'bad-message') this.onFatal(msg.reason)

				break
		}
	}

	onMessage(cb: (connId: string, msg: ClientMessage) => void) {
		this.messageCb = cb
	}
	onDisconnect(cb: (connId: string) => void) {
		this.disconnectCb = cb
	}
	send(connId: string, msg: HostMessage) {
		this.socket.send({ t: 'to', to: connId, data: msg })
	}
	broadcast(msg: HostMessage) {
		for (const id of this.guests) this.send(id, msg)
	}
	close() {
		this.socket.close()
	}
}

/** Guest side: a channel to the host through the relay room. */
export class WsGuestTransport implements GuestTransport {
	private socket: ReconnectingSocket
	private hostOnline = false
	private messageCb: (msg: HostMessage) => void = () => {}
	private openCbs = new Set<() => void>()
	private closeCbs = new Set<() => void>()
	private readonly code: string
	private readonly playerId: string
	private readonly onFatal: (reason: Fatal) => void

	constructor(url: string, code: string, playerId: string, onFatal: (reason: Fatal) => void = () => {}) {
		this.code = code
		this.playerId = playerId
		this.onFatal = onFatal

		this.socket = new ReconnectingSocket(
			url,
			() => this.socket.send({ t: 'join', code: this.code, id: this.playerId }),
			(msg) => this.handle(msg),
			() => this.setHostOnline(false),
		)
	}

	/**
	 * The channel counts as open only when the host is in the room: the socket to the relay alone
	 * doesn't move the game. Each open fires onOpen, where net.ts introduces itself (`hello`), so
	 * a returning host immediately learns who's already there.
	 */
	private setHostOnline(online: boolean) {
		if (online === this.hostOnline) return

		this.hostOnline = online

		for (const cb of online ? this.openCbs : this.closeCbs) cb()
	}

	private handle(msg: RelayOut) {
		switch (msg.t) {
			case 'host-online':
				this.setHostOnline(msg.online)
				break
			case 'from':
				this.messageCb(msg.data as HostMessage)
				break
			case 'error':
				if (msg.reason !== 'bad-message') this.onFatal(msg.reason)

				break
		}
	}

	get open() {
		return this.socket.open && this.hostOnline
	}
	onMessage(cb: (msg: HostMessage) => void) {
		this.messageCb = cb
	}
	onOpen(cb: () => void) {
		this.openCbs.add(cb)
	}
	onClose(cb: () => void) {
		this.closeCbs.add(cb)
	}
	send(msg: ClientMessage) {
		this.socket.send({ t: 'to', data: msg })
	}
	close() {
		this.socket.close()
	}
}
