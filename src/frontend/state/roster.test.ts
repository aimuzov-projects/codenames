import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Role, Team } from '#frontend/game/index.ts'
import {
	isRosterReady,
	pickSlot,
	randomSetup,
	reshuffleRoster,
	resolveSetup,
	teamHasSpymaster,
} from '#frontend/state/roster.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

let seq = 0
function player(team: Team, role: Role, connected = true): PlayerInfo {
	return { id: `p${seq++}`, name: 'Игрок', team, role, connected }
}

/** Детерминированный rng (mulberry32) для воспроизводимых перетасовок в тестах. */
function makeRng(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function spymastersOf(roster: PlayerInfo[], team: Team): PlayerInfo[] {
	return roster.filter((p) => p.team === team && p.role === 'spymaster')
}

const full: PlayerInfo[] = [
	{ id: 'rs', name: 'КрасныйКап', team: 'red', role: 'spymaster', connected: true },
	{ id: 'ro', name: 'КрасныйОп', team: 'red', role: 'operative', connected: true },
	{ id: 'bs', name: 'СинийКап', team: 'blue', role: 'spymaster', connected: true },
	{ id: 'bo', name: 'СинийОп', team: 'blue', role: 'operative', connected: true },
]

describe('teamHasSpymaster', () => {
	it('видит капитана команды и исключает указанного игрока', () => {
		assert.equal(teamHasSpymaster(full, 'red'), true)
		assert.equal(teamHasSpymaster(full, 'red', 'rs'), false)
		assert.equal(teamHasSpymaster(full, 'blue', 'rs'), true)
	})
})

describe('pickSlot', () => {
	it('первый игрок (пустой ростер) — красный капитан', () => {
		assert.deepEqual(pickSlot([]), { team: 'red', role: 'spymaster' })
	})

	it('второй игрок попадает в пустую команду капитаном', () => {
		const roster = [player('red', 'spymaster')]
		assert.deepEqual(pickSlot(roster), { team: 'blue', role: 'spymaster' })
	})

	it('третий и четвёртый добивают игроков в обе команды', () => {
		const roster = [player('red', 'spymaster'), player('blue', 'spymaster')]
		const third = pickSlot(roster)
		assert.equal(third.role, 'operative')
		roster.push(player(third.team, third.role))
		const fourth = pickSlot(roster)
		assert.equal(fourth.role, 'operative')
		roster.push(player(fourth.team, fourth.role))
		// По итогу — корректный 4-составный ростер.
		assert.equal(isRosterReady(roster), true)
	})

	it('садит в команду с меньшим числом игроков', () => {
		const roster = [player('red', 'spymaster'), player('red', 'operative')]
		assert.equal(pickSlot(roster).team, 'blue')
	})
})

describe('resolveSetup', () => {
	it('понижает второго капитана команды до игрока', () => {
		const roster = [player('red', 'spymaster')]
		assert.deepEqual(resolveSetup(roster, 'newbie', 'red', 'spymaster'), {
			team: 'red',
			role: 'operative',
		})
	})

	it('не трогает капитана, если в команде нет другого капитана', () => {
		const roster = [player('red', 'operative')]
		assert.deepEqual(resolveSetup(roster, 'newbie', 'red', 'spymaster'), {
			team: 'red',
			role: 'spymaster',
		})
	})

	it('позволяет игроку остаться капитаном своей команды', () => {
		assert.deepEqual(resolveSetup(full, 'rs', 'red', 'spymaster'), { team: 'red', role: 'spymaster' })
	})

	it('пропускает игрока без изменений', () => {
		assert.deepEqual(resolveSetup(full, 'x', 'red', 'operative'), { team: 'red', role: 'operative' })
	})
})

describe('isRosterReady', () => {
	it('false при одном капитане', () => {
		assert.equal(isRosterReady([player('red', 'spymaster')]), false)
	})

	it('false, если в команде нет игрока', () => {
		const roster = [player('red', 'spymaster'), player('blue', 'spymaster'), player('red', 'operative')]
		assert.equal(isRosterReady(roster), false)
	})

	it('true для полного 4-составного ростера', () => {
		assert.equal(isRosterReady(full), true)
	})

	it('не учитывает отключённых игроков', () => {
		const roster = [
			player('red', 'spymaster'),
			player('red', 'operative'),
			player('blue', 'spymaster'),
			player('blue', 'operative', false),
		]
		assert.equal(isRosterReady(roster), false)
	})
})

describe('randomSetup', () => {
	it('никогда не назначает второго капитана в занятую команду', () => {
		const roster = [player('red', 'spymaster'), player('blue', 'spymaster')]
		// Доступны только red/blue-operative. Из синего всегда уходим в красный.
		const current = { team: 'blue' as Team, role: 'operative' as Role }
		assert.deepEqual(
			randomSetup(roster, 'me', current, () => 0),
			{ team: 'red', role: 'operative' },
		)
		assert.deepEqual(
			randomSetup(roster, 'me', current, () => 0.99),
			{
				team: 'red',
				role: 'operative',
			},
		)
	})

	it('может выдать капитана, если команда свободна', () => {
		// current=red-operative исключается; rng=0 → первый из оставшихся (red-spymaster).
		assert.deepEqual(
			randomSetup([], 'me', { team: 'red', role: 'operative' }, () => 0),
			{
				team: 'red',
				role: 'spymaster',
			},
		)
	})

	it('не повторяет текущий вариант ни при каком rng', () => {
		const combos: { team: Team; role: Role }[] = [
			{ team: 'red', role: 'operative' },
			{ team: 'red', role: 'spymaster' },
			{ team: 'blue', role: 'operative' },
			{ team: 'blue', role: 'spymaster' },
		]
		for (const current of combos) {
			for (const rng of [0, 0.25, 0.5, 0.75, 0.99]) {
				assert.notDeepEqual(
					randomSetup([], 'me', current, () => rng),
					current,
				)
			}
		}
	})

	it('переключает команду, когда оба капитана заняты', () => {
		const roster = [player('red', 'spymaster'), player('blue', 'spymaster')]
		assert.deepEqual(
			randomSetup(roster, 'me', { team: 'red', role: 'operative' }, () => 0),
			{
				team: 'blue',
				role: 'operative',
			},
		)
	})
})

describe('reshuffleRoster', () => {
	it('возвращает ростер без изменений, если подключённых меньше 4', () => {
		const roster = [player('red', 'spymaster'), player('blue', 'spymaster'), player('red', 'operative')]
		assert.deepEqual(reshuffleRoster(roster, makeRng(1)), roster)
	})

	it('всегда даёт валидный сбалансированный состав (4–8 игроков, много сидов)', () => {
		for (let n = 4; n <= 8; n++) {
			const roster = Array.from({ length: n }, (_, i) => player(i % 2 === 0 ? 'red' : 'blue', 'operative'))
			for (let seed = 0; seed < 25; seed++) {
				const next = reshuffleRoster(roster, makeRng(seed))
				assert.equal(isRosterReady(next), true)
				// ровно один капитан на команду
				assert.equal(spymastersOf(next, 'red').length, 1)
				assert.equal(spymastersOf(next, 'blue').length, 1)
				// все игроки сохранены
				assert.deepEqual([...next].map((p) => p.id).sort(), roster.map((p) => p.id).sort())
			}
		}
	})

	it('перетасовывает хоста наравне со всеми', () => {
		const roster = [
			{ id: 'host', name: 'Хост', team: 'red' as Team, role: 'spymaster' as Role, connected: true },
			player('blue', 'spymaster'),
			player('red', 'operative'),
			player('blue', 'operative'),
		]
		const moved = Array.from({ length: 30 }, (_, s) => reshuffleRoster(roster, makeRng(s))).some((r) => {
			const h = r.find((p) => p.id === 'host')!
			return h.team !== 'red' || h.role !== 'spymaster'
		})
		assert.equal(moved, true)
	})

	it('детерминирован при одинаковом rng', () => {
		const roster = [
			player('red', 'spymaster'),
			player('blue', 'spymaster'),
			player('red', 'operative'),
			player('blue', 'operative'),
		]
		assert.deepEqual(reshuffleRoster(roster, makeRng(7)), reshuffleRoster(roster, makeRng(7)))
	})

	it('офлайн-игрока оставляет в его команде, но снимает капитанство', () => {
		const roster = [
			player('red', 'spymaster'),
			player('red', 'operative'),
			player('blue', 'spymaster'),
			player('blue', 'operative'),
			{
				id: 'off',
				name: 'Офлайн',
				team: 'blue' as Team,
				role: 'spymaster' as Role,
				connected: false,
			},
		]
		const next = reshuffleRoster(roster, makeRng(3))
		const off = next.find((p) => p.id === 'off')!
		assert.equal(off.connected, false)
		assert.equal(off.team, 'blue')
		assert.equal(off.role, 'operative')
		// баланс среди подключённых сохранён
		assert.equal(isRosterReady(next), true)
	})
})
