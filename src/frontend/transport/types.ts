import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'

/**
 * Common transport contract. There are two implementations: QR/WebRTC (offline, handshake via camera)
 * and the WS relay (online, reconnects by itself). The session layer (net.ts) works only with this
 * interface, so the lobby and game logic is the same in both modes.
 */

/** Host side: holds connections to guests and addresses messages by connection id. */
export type HostTransport = {
	onMessage(cb: (connId: string, msg: ClientMessage) => void): void
	onDisconnect(cb: (connId: string) => void): void
	send(connId: string, msg: HostMessage): void
	broadcast(msg: HostMessage): void
	close(): void
}

/** Guest side: a single channel to the host. */
export type GuestTransport = {
	readonly open: boolean
	onMessage(cb: (msg: HostMessage) => void): void
	onOpen(cb: () => void): void
	onClose(cb: () => void): void
	send(msg: ClientMessage): void
	close(): void
}
