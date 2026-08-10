import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerInfo } from '@/transport/messages.ts'

vi.mock('@/transport/webrtc.ts', () => ({
	HostConnection: class {
		onMessage() {}
		onOpen() {}
		onClose() {}
		send() {}
		close() {}
	},
	GuestConnection: class {
		onMessage() {}
		onOpen() {}
		onClose() {}
		send() {}
		close() {}
	},
}))

const { leaveSession, myIdAtom, resumeSession, rosterAtom, savedSessionAtom, startedAtom } =
	await import('./net.ts')
const { gameAtom, modeAtom, myRoleAtom, remoteViewAtom } = await import('./session.ts')
const { screenAtom } = await import('./ui.ts')
const { createGame, redactStateForRole } = await import('@/game/index.ts')

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

		expect(resumeSession()).toBe(true)
		expect(modeAtom()).toBe('host')
		expect(gameAtom()?.cards).toHaveLength(25)
		expect(screenAtom()).toBe('board')
		// Соединений после перезапуска нет ни у кого, кроме нас самих.
		expect(rosterAtom().find((p) => p.id === 'dev1')?.connected).toBe(false)
		expect(rosterAtom().find((p) => p.id === 'host')?.connected).toBe(true)
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

		expect(resumeSession()).toBe(true)
		expect(modeAtom()).toBe('guest')
		expect(myIdAtom()).toBe('dev1')
		expect(myRoleAtom()).toBe('operative')
		expect(remoteViewAtom()?.cards).toHaveLength(25)
		expect(startedAtom()).toBe(true)
		expect(screenAtom()).toBe('board')
	})

	it('без сохранённой сессии возвращать нечего', () => {
		savedSessionAtom.set(null)
		expect(resumeSession()).toBe(false)
	})
})
