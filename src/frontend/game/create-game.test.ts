import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createGame } from '#frontend/game/create-game.ts'
import type { CardType, Rng } from '#frontend/game/types.ts'

/** Pool of 30 unique words for tests. */
const WORDS = Array.from({ length: 30 }, (_, i) => `слово${i + 1}`)

/** Deterministic RNG (always 0): takes the first elements, doesn't shuffle. */
const rngZero: Rng = () => 0

function countTypes(types: CardType[]): Record<CardType, number> {
	return types.reduce((acc, t) => ({ ...acc, [t]: acc[t] + 1 }), {
		red: 0,
		blue: 0,
		neutral: 0,
		assassin: 0,
	})
}

describe('createGame', () => {
	it('раздаёт ровно 25 карт', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		assert.equal(state.cards.length, 25)
	})

	it('распределяет типы 9/8/7/1 в пользу стартовой команды (red)', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		const counts = countTypes(state.cards.map((c) => c.type))
		assert.deepEqual(counts, { red: 9, blue: 8, neutral: 7, assassin: 1 })
	})

	it('распределяет 9 карт стартовой команде blue', () => {
		const state = createGame({ words: WORDS, startingTeam: 'blue' }, rngZero)
		const counts = countTypes(state.cards.map((c) => c.type))
		assert.deepEqual(counts, { red: 8, blue: 9, neutral: 7, assassin: 1 })
	})

	it('начинает в фазе подсказки, ход у стартовой команды, без победителя', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		assert.equal(state.phase, 'clue')
		assert.equal(state.currentTeam, 'red')
		assert.equal(state.startingTeam, 'red')
		assert.equal(state.winner, null)
		assert.equal(state.clue, null)
	})

	it('все карты изначально закрыты', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		assert.equal(
			state.cards.every((c) => !c.revealed),
			true,
		)
	})

	it('начинает с пустым логом таймлайна', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		assert.deepEqual(state.log, [])
	})

	it('использует только слова из пула, без повторов', () => {
		const state = createGame({ words: WORDS, startingTeam: 'red' }, rngZero)
		const used = state.cards.map((c) => c.word)
		assert.equal(new Set(used).size, 25)
		assert.equal(
			used.every((w) => WORDS.includes(w)),
			true,
		)
	})

	it('бросает ошибку, если в пуле меньше 25 слов', () => {
		assert.throws(() => createGame({ words: WORDS.slice(0, 24), startingTeam: 'red' }, rngZero))
	})

	it('выбирает стартовую команду через RNG, если не задана', () => {
		// rng < 0.5 -> red, otherwise blue (checking both branches deterministically)
		const red = createGame({ words: WORDS }, () => 0)
		const blue = createGame({ words: WORDS }, () => 0.99)
		assert.equal(red.startingTeam, 'red')
		assert.equal(blue.startingTeam, 'blue')
	})
})
