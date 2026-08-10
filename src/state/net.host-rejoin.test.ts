import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage, HostMessage } from '@/transport/messages.ts'

/** Поддельное соединение хоста: копит отправленное и позволяет руками эмулировать события канала. */
interface FakeConn {
	sent: HostMessage[]
	emitMessage(msg: ClientMessage): void
	emitClose(): void
}

const conns: FakeConn[] = []

vi.mock('@/transport/webrtc.ts', () => {
	class HostConnection {
		sent: HostMessage[] = []
		private messageCb: (msg: ClientMessage) => void = () => {}
		private closeCb: () => void = () => {}

		constructor() {
			conns.push(this as FakeConn)
		}
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
	// GuestConnection в хостовом сценарии не создаётся — нужен лишь как импортируемый символ.
	return { HostConnection, GuestConnection: class {} }
})

const { acceptGuestOffer, hostStartGame, leaveSession, rosterAtom, startHosting } =
	await import('./net.ts')

const words = Array.from({ length: 25 }, (_, i) => `слово${i}`)

const player = (id: string) => rosterAtom().find((p) => p.id === id)

describe('хост: возвращение игрока после обрыва', () => {
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

		expect(rosterAtom()).toHaveLength(2)
		expect(player('dev1')).toMatchObject({ team: 'blue', role: 'spymaster', connected: true })

		// Устройство уснуло — канал закрылся. Во время партии игрока из ростера не убираем.
		conns[0]!.emitClose()
		expect(player('dev1')).toMatchObject({ connected: false })

		// Переподключение: новое соединение, тот же id устройства.
		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })

		expect(rosterAtom()).toHaveLength(2) // дубля не завелось
		expect(player('dev1')).toMatchObject({ team: 'blue', role: 'spymaster', connected: true })
		// Капитану уходит его вид состояния — доска у вернувшегося наполняется сразу.
		const state = conns[1]!.sent.find((m) => m.t === 'state')
		expect(state).toBeDefined()
		expect(state?.t === 'state' && state.state.cards.every((c) => c.type !== undefined)).toBe(true)
	})

	it('запоздалое закрытие старого канала не выбивает уже вернувшегося игрока', async () => {
		await acceptGuestOffer('offer')
		conns[0]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		hostStartGame({ words })

		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		// Обрыв WebRTC замечают с задержкой: close по старому каналу приходит после реконнекта.
		conns[0]!.emitClose()

		expect(player('dev1')).toMatchObject({ connected: true })
	})

	it('интенты с неопознанного соединения (до hello) игнорируются', async () => {
		await acceptGuestOffer('offer')
		conns[0]!.emitMessage({ t: 'hello', id: 'dev1', name: 'Гость' })
		conns[0]!.emitMessage({ t: 'setup', team: 'red', role: 'operative' })
		hostStartGame({ words })

		await acceptGuestOffer('offer2')
		conns[1]!.emitMessage({ t: 'intent', event: { type: 'END_TURN' } })

		expect(conns[1]!.sent).toHaveLength(0)
	})
})
