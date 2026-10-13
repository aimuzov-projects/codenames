import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'
import { HostConnection } from '#frontend/transport/webrtc.ts'

/**
 * Manages the host's many connections to guests (star topology).
 * Works with connection ids (connId), not players: one player can get several connections in a row
 * during a game (reconnecting after sleep). The connId ↔ playerId mapping is kept by
 * net.ts, based on the `hello` the guest sends.
 */
/** Host side of one WebRTC channel: exactly what the hub uses from HostConnection. */
type QrHostConnection = {
	onMessage(cb: (msg: ClientMessage) => void): void
	onOpen(cb: () => void): void
	onClose(cb: () => void): void
	acceptOfferCode(code: string): Promise<string>
	send(msg: HostMessage): void
	close(): void
}

export class HostHub {
	private conns = new Map<string, QrHostConnection>()
	private messageCb: (connId: string, msg: ClientMessage) => void = () => {}
	private connectCb: (connId: string) => void = () => {}
	private disconnectCb: (connId: string) => void = () => {}

	private readonly connect: (connId: string) => QrHostConnection

	/** Unit tests swap the channel factory for a fake: Node has no WebRTC. */
	constructor(
		connect: (connId: string) => QrHostConnection = (connId) =>
			new HostConnection<ClientMessage, HostMessage>(connId),
	) {
		this.connect = connect
	}

	onMessage(cb: (connId: string, msg: ClientMessage) => void) {
		this.messageCb = cb
	}
	onConnect(cb: (connId: string) => void) {
		this.connectCb = cb
	}
	onDisconnect(cb: (connId: string) => void) {
		this.disconnectCb = cb
	}

	/** Accepts a guest's offer, returns the connection id and the answer code to show the guest. */
	async acceptGuest(offerCode: string): Promise<{ connId: string; answerCode: string }> {
		const connId = crypto.randomUUID().slice(0, 8)
		const conn = this.connect(connId)
		// Subscribe before the handshake so the channel open event isn't missed.
		conn.onMessage((m) => this.messageCb(connId, m))
		conn.onOpen(() => this.connectCb(connId))
		conn.onClose(() => {
			// A dead connection is dropped right away: one piles up per guest reconnect during a game,
			// and broadcasts walk the whole map.
			this.conns.delete(connId)
			conn.close()
			this.disconnectCb(connId)
		})
		const answerCode = await conn.acceptOfferCode(offerCode)
		this.conns.set(connId, conn)
		return { connId, answerCode }
	}

	send(connId: string, msg: HostMessage) {
		this.conns.get(connId)?.send(msg)
	}

	broadcast(msg: HostMessage) {
		for (const conn of this.conns.values()) conn.send(msg)
	}

	ids(): string[] {
		return [...this.conns.keys()]
	}

	close() {
		for (const conn of this.conns.values()) conn.close()
		this.conns.clear()
	}
}
