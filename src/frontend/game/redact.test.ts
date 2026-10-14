import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { redactStateForRole } from '#frontend/game/redact.ts'
import type { Card, GameState } from '#frontend/game/types.ts'

const cards: Card[] = [
	{ word: 'a', type: 'red', revealed: true },
	{ word: 'b', type: 'blue', revealed: false },
	{ word: 'c', type: 'assassin', revealed: false },
	{ word: 'd', type: 'neutral', revealed: true },
]

const state: GameState = {
	cards,
	startingTeam: 'red',
	currentTeam: 'blue',
	phase: 'guess',
	clue: { word: 'тест', count: 2, team: 'blue' },
	guessesRemaining: 3,
	prevClueWord: { red: null, blue: null },
	winner: null,
	log: [],
}

describe('redactStateForRole', () => {
	it('капитан видит истинный тип всех карт', () => {
		const r = redactStateForRole(state, 'spymaster')

		assert.deepEqual(
			r.cards.map((c) => c.type),
			['red', 'blue', 'assassin', 'neutral'],
		)
	})

	it('игрок видит тип только у открытых карт, у закрытых — null', () => {
		const r = redactStateForRole(state, 'operative')

		assert.deepEqual(
			r.cards.map((c) => c.type),
			['red', null, null, 'neutral'],
		)
	})

	it('сохраняет слова и флаги revealed', () => {
		const r = redactStateForRole(state, 'operative')

		assert.deepEqual(
			r.cards.map((c) => c.word),
			['a', 'b', 'c', 'd'],
		)

		assert.deepEqual(
			r.cards.map((c) => c.revealed),
			[true, false, false, true],
		)
	})

	it('сохраняет остальные поля состояния', () => {
		const r = redactStateForRole(state, 'operative')

		assert.equal(r.currentTeam, 'blue')
		assert.equal(r.startingTeam, 'red')
		assert.equal(r.phase, 'guess')
		assert.deepEqual(r.clue, { word: 'тест', count: 2, team: 'blue' })
		assert.equal(r.guessesRemaining, 3)
		assert.equal(r.winner, null)
		assert.equal(r.log, state.log)
	})

	it('не мутирует исходное состояние', () => {
		const snapshot = JSON.stringify(state)

		redactStateForRole(state, 'operative')
		assert.equal(JSON.stringify(state), snapshot)
	})
})
