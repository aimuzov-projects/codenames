import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import {
	acceptGuestOffer,
	hostStartGame,
	leaveSession,
	qrTransports,
	rosterAtom,
	startHosting,
} from '#frontend/state/net.ts'
import { HostHub } from '#frontend/transport/host-hub.ts'
import type { ClientMessage, HostMessage } from '#frontend/transport/messages.ts'

/** Поддельное соединение хоста: копит отправленное и позволяет руками эмулировать события канала. */
class FakeConn {
	sent: HostMessage[] = []
	private messageCb: (msg: ClientMessage) => void = () => {}
	private closeCb: () => void = () => {}

	onMessage(cb: (msg: ClientMessage) => void) {
		this.messageCb = cb
	}
	onOpen() {}
	onClose(cb: () => void) {
		this.closeCb = cb
	}
	acceptOfferCode() {
		return Promise.resolve('answer')
	}
	send(msg: HostMessage) {
		this.sent.push(msg)
	}
	close() {}

	emitMessage(msg: ClientMessage) {
		this.messageCb(msg)
	}
	emitClose() {
		this.closeCb()
	}
}

const conns: FakeConn[] = []

qrTransports.host = () =>
	new HostHub(() => {
		const conn = new FakeConn()
		conns.push(conn)
		return conn
	})

const words = Array.from({ length: 25 }, (_, i) => `слово${i}`)

const player = (id: string) => rosterAtom().find((p) => p.id === id)

describe('хост: возвращение игрока после обрыва', () => {
	// Пульс сессии держит таймер: без выхода из неё процесс теста не завершится.
	after(() => leaveSession())

	beforeEach(() => {
		leaveSession()
		conns.length = 0
		startHosting('Хост', 'red', 'spymaster')
	})

	it('игрок с тем же id садится на прежнее место и сразу получает состояние партии', async () => {
		await acceptGuestOffer('offer')
		conns[0]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		conns[0]!.emitMessage({ t: 'setup', team: 'blue', role: 'spymaster' })
		hostStartGame({ words })

		assert.equal(rosterAtom().length, 2)
		assert.partialDeepStrictEqual(player('dev1'), { team: 'blue', role: 'spymaster', connected: true })

		// Устройство уснуло — канал закрылся. Во время партии игрока из ростера не убираем.
		conns[0]!.emitClose()
		assert.partialDeepStrictEqual(player('dev1'), { connected: false })

		// Переподключение: новое соединение, тот же id устройства.
		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })

		assert.equal(rosterAtom().length, 2) // дубля не завелось
		assert.partialDeepStrictEqual(player('dev1'), { team: 'blue', role: 'spymaster', connected: true })
		// Капитану уходит его вид состояния — доска у вернувшегося наполняется сразу.
		const state = conns[1]!.sent.find((m) => m.t === 'state')
		assert.notEqual(state, undefined)
		assert.equal(state?.t === 'state' && state.state.cards.every((c) => c.type !== undefined), true)
	})

	it('запоздалое закрытие старого канала не выбивает уже вернувшегося игрока', async () => {
		await acceptGuestOffer('offer')
		conns[0]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		hostStartGame({ words })

		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		// Обрыв WebRTC замечают с задержкой: close по старому каналу приходит после реконнекта.
		conns[0]!.emitClose()

		assert.partialDeepStrictEqual(player('dev1'), { connected: true })
	})

	it('интенты с неопознанного соединения (до hello) игнорируются', async () => {
		await acceptGuestOffer('offer')
		conns[0]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		conns[0]!.emitMessage({ t: 'setup', team: 'red', role: 'operative' })
		hostStartGame({ words })

		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'intent', event: { type: 'END_TURN' } })

		assert.equal(conns[1]!.sent.length, 0)
	})
})
