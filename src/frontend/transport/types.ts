import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'

/**
 * Общий контракт транспортов. Реализаций две: QR/WebRTC (офлайн, рукопожатие через камеру)
 * и WS-релей (онлайн, переподключается сам). Слой сессии (net.ts) работает только с этим
 * интерфейсом, поэтому логика лобби и партии одинакова в обоих режимах.
 */

/** Сторона хоста: держит соединения с гостями и адресует сообщения по id соединения. */
export type HostTransport = {
	onMessage(cb: (connId: string, msg: ClientMessage) => void): void
	onDisconnect(cb: (connId: string) => void): void
	send(connId: string, msg: HostMessage): void
	broadcast(msg: HostMessage): void
	close(): void
}

/** Сторона гостя: один канал до хоста. */
export type GuestTransport = {
	readonly open: boolean
	onMessage(cb: (msg: HostMessage) => void): void
	onOpen(cb: () => void): void
	onClose(cb: () => void): void
	send(msg: ClientMessage): void
	close(): void
}
