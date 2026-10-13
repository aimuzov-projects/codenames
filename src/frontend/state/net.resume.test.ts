import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { createGame, redactStateForRole } from '#frontend/game/index.ts'
import {
	leaveSession,
	myIdAtom,
	qrTransports,
	resumeSession,
	rosterAtom,
	savedSessionAtom,
	startedAtom,
} from '#frontend/state/net.ts'
import { gameAtom, modeAtom, myRoleAtom, remoteViewAtom } from '#frontend/state/session.ts'
import { screenAtom } from '#frontend/state/ui.ts'
import { HostHub } from '#frontend/transport/host-hub.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

// Восстановление поднимает транспорт заново; в Node WebRTC нет, хватает пустых заглушек.
qrTransports.host = () => new HostHub()
qrTransports.guest = () => ({
	open: false,
	onMessage() {},
	onOpen() {},
	onClose() {},
	createOfferCode: () => Promise.resolve('offer'),
	acceptAnswerCode: () => Promise.resolve(),
	send() {},
	close() {},
})

const words = Array.from({ length: 25 }, (_, i) => `слово${i}`)

const roster: PlayerInfo[] = [
	{ id: 'host', name: 'Хост', team: 'red', role: 'spymaster', connected: true },
	{ id: 'dev1', name: 'Гость', team: 'blue', role: 'operative', connected: true },
]

describe('восстановление сессии после перезапуска приложения', () => {
	beforeEach(() => {
		leaveSession()
		screenAtom.set('home')
	})

	it('хост возвращается к своей партии, гости ждут переподключения', () => {
		const game = createGame({ words, startingTeam: 'red' })
		savedSessionAtom.set({
			v: 1,
			ts: Date.now(),
			mode: 'host',
			transport: 'qr',
			code: '',
			id: 'host',
			name: 'Хост',
			team: 'red',
			role: 'spymaster',
			roster,
			started: true,
			game,
			view: null,
		})

		assert.equal(resumeSession(), true)
		assert.equal(modeAtom(), 'host')
		assert.equal(gameAtom()?.cards.length, 25)
		assert.equal(screenAtom(), 'board')
		// Соединений после перезапуска нет ни у кого, кроме нас самих.
		assert.equal(rosterAtom().find((p) => p.id === 'dev1')?.connected, false)
		assert.equal(rosterAtom().find((p) => p.id === 'host')?.connected, true)
	})

	it('гость возвращается на свою доску со статусом «связь потеряна»', () => {
		const view = redactStateForRole(createGame({ words, startingTeam: 'blue' }), 'operative')
		savedSessionAtom.set({
			v: 1,
			ts: Date.now(),
			mode: 'guest',
			transport: 'qr',
			code: '',
			id: 'dev1',
			name: 'Гость',
			team: 'blue',
			role: 'operative',
			roster,
			started: true,
			game: null,
			view,
		})

		assert.equal(resumeSession(), true)
		assert.equal(modeAtom(), 'guest')
		assert.equal(myIdAtom(), 'dev1')
		assert.equal(myRoleAtom(), 'operative')
		assert.equal(remoteViewAtom()?.cards.length, 25)
		assert.equal(startedAtom(), true)
		assert.equal(screenAtom(), 'board')
	})

	it('без сохранённой сессии возвращать нечего', () => {
		savedSessionAtom.set(null)
		assert.equal(resumeSession(), false)
	})
})
