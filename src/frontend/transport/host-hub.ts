import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'
import { HostConnection } from '#frontend/transport/webrtc.ts'

/**
 * Управляет множеством соединений хоста с гостями (топология «звезда»).
 * Оперирует id соединения (connId), а не игрока: одному игроку за партию может достаться
 * несколько соединений подряд (переподключение после сна). Связку connId ↔ playerId держит
 * net.ts по присланному гостем `hello`.
 */
/** Хостовая сторона одного WebRTC-канала: ровно то, чем хаб пользуется у HostConnection. */
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

	/** Фабрику канала юнит-тесты подменяют подделкой: в Node нет WebRTC. */
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

	/** Принимает offer гостя, возвращает id соединения и answer-код для показа гостю. */
	async acceptGuest(offerCode: string): Promise<{ connId: string; answerCode: string }> {
		const connId = crypto.randomUUID().slice(0, 8)
		const conn = this.connect(connId)
		// Подписки — до рукопожатия, чтобы не пропустить событие открытия канала.
		conn.onMessage((m) => this.messageCb(connId, m))
		conn.onOpen(() => this.connectCb(connId))
		conn.onClose(() => {
			// Мёртвое соединение выбрасываем сразу: за партию их накапливается по одному
			// на каждое переподключение гостя, а рассылка ходит по всей карте.
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
