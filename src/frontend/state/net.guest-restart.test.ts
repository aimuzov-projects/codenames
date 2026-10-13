import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { createGame, redactStateForRole } from '#frontend/game/index.ts'
import { leaveSession, qrTransports, startJoining } from '#frontend/state/net.ts'
import { isOverAtom, modeAtom, remoteViewAtom } from '#frontend/state/session.ts'
import { screenAtom } from '#frontend/state/ui.ts'
import type { HostMessage } from '#frontend/transport/messages.ts'

// Grab the callback the guest registers via onMessage,
// so we can "deliver" host messages to it by hand.
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
	// The session heartbeat holds a timer: without leaving the session the test process won't exit.
	after(() => leaveSession())

	beforeEach(() => {
		// Atoms are module singletons, so we reset the state between tests.
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

		// The first game reached the end, the host sent the over state.
		const overGame = {
			...createGame({ words, startingTeam: 'red' }),
			phase: 'over' as const,
			winner: 'red' as const,
		}
		deliver!({ t: 'state', state: redactStateForRole(overGame, 'operative') })

		assert.equal(screenAtom(), 'board')
		assert.equal(isOverAtom(), true) // win overlay is shown

		// RESTART: the host taps "New game" → broadcasts lobby(started) + a fresh state.
		const fresh = createGame({ words, startingTeam: 'blue' })
		deliver!({ t: 'lobby', players, started: true })
		deliver!({ t: 'state', state: redactStateForRole(fresh, 'operative') })

		assert.equal(remoteViewAtom()?.phase, 'clue')
		assert.equal(isOverAtom(), false) // the overlay must go away
	})

	it('lobby(started) без state не уводит гостя на пустую доску — переход по приходу state', () => {
		startJoining('Гость')
		deliver!({ t: 'welcome', youId: 'g1' })
		deliver!({ t: 'lobby', players, started: false })

		// The host starts: lobby(started) arrives first. state is still in flight.
		deliver!({ t: 'lobby', players, started: true })

		// The guest waits for the state instead of sitting on an empty board (this used to be view === null
		// on the board screen → Board called goTo('home') and the guest got kicked out).
		assert.equal(remoteViewAtom(), null)
		assert.notEqual(screenAtom(), 'board')

		// The state arrives, now there's something to show: go to the board.
		deliver!({ t: 'state', state: redactStateForRole(createGame({ words, startingTeam: 'red' }), 'operative') })
		assert.equal(screenAtom(), 'board')
		assert.notEqual(remoteViewAtom(), null)
	})
})
