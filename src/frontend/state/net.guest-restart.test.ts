import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { createGame, redactStateForRole } from '#frontend/game/index.ts'
import { leaveSession, qrTransports, startJoining } from '#frontend/state/net.ts'
import { isOverAtom, modeAtom, remoteViewAtom } from '#frontend/state/session.ts'
import { screenAtom } from '#frontend/state/ui.ts'
import type { HostMessage } from '#frontend/transport/messages.ts'

// Перехватываем колбэк, который гость регистрирует через onMessage,
// чтобы вручную «доставлять» ему сообщения хоста.
let deliver: ((msg: HostMessage) => void) | null = null

qrTransports.guest = () => ({
	open: true,
	onMessage(cb: (msg: HostMessage) => void) {
		deliver = cb
	},
	onOpen() {},
	onClose() {},
	createOfferCode: () => Promise.resolve('offer'),
	acceptAnswerCode: () => Promise.resolve(),
	send() {},
	close() {},
})

const words = Array.from({ length: 25 }, (_, i) => `слово${i}`)
const players = [{ id: 'g1', name: 'Гость', team: 'red' as const, role: 'operative' as const, connected: true }]

describe('гость: переходы доски при старте/рестарте партии', () => {
	// Пульс сессии держит таймер: без выхода из неё процесс теста не завершится.
	after(() => leaveSession())

	beforeEach(() => {
		// Атомы — модульные синглтоны, сбрасываем состояние между тестами.
		deliver = null
		screenAtom.set('home')
		remoteViewAtom.set(null)
		modeAtom.set('local')
	})

	it('новый state после финала убирает оверлей победы (рестарт)', () => {
		startJoining('Гость')
		assert.ok(deliver)

		deliver!({ t: 'welcome', youId: 'g1' })
		deliver!({ t: 'lobby', players, started: true })

		// Первая партия дошла до конца — хост прислал over-состояние.
		const overGame = {
			...createGame({ words, startingTeam: 'red' }),
			phase: 'over' as const,
			winner: 'red' as const,
		}

		deliver!({ t: 'state', state: redactStateForRole(overGame, 'operative') })

		assert.equal(screenAtom(), 'board')
		assert.equal(isOverAtom(), true) // оверлей победы показан

		// РЕСТАРТ: хост жмёт «Новая игра» → рассылает lobby(started) + свежий state.
		const fresh = createGame({ words, startingTeam: 'blue' })

		deliver!({ t: 'lobby', players, started: true })
		deliver!({ t: 'state', state: redactStateForRole(fresh, 'operative') })

		assert.equal(remoteViewAtom()?.phase, 'clue')
		assert.equal(isOverAtom(), false) // оверлей должен исчезнуть
	})

	it('lobby(started) без state не уводит гостя на пустую доску — переход по приходу state', () => {
		startJoining('Гость')
		deliver!({ t: 'welcome', youId: 'g1' })
		deliver!({ t: 'lobby', players, started: false })

		// Хост стартует: первым приходит lobby(started). state ещё в пути.
		deliver!({ t: 'lobby', players, started: true })

		// Гость ждёт состояние, а не висит на пустой доске (раньше тут было view === null
		// на экране board → Board дёргал goTo('home') и гостя выкидывало).
		assert.equal(remoteViewAtom(), null)
		assert.notEqual(screenAtom(), 'board')

		// Приходит состояние — теперь есть, что показать: переходим на доску.
		deliver!({ t: 'state', state: redactStateForRole(createGame({ words, startingTeam: 'red' }), 'operative') })
		assert.equal(screenAtom(), 'board')
		assert.notEqual(remoteViewAtom(), null)
	})
})
