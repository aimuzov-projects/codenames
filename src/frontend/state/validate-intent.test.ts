import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GameState } from '#frontend/game/index.ts'
import { validateIntent } from '#frontend/state/validate-intent.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

const roster: PlayerInfo[] = [
	{ id: 'rs', name: 'КрасныйКап', team: 'red', role: 'spymaster', connected: true },
	{ id: 'ro', name: 'КрасныйОп', team: 'red', role: 'operative', connected: true },
	{ id: 'bs', name: 'СинийКап', team: 'blue', role: 'spymaster', connected: true },
	{ id: 'bo', name: 'СинийОп', team: 'blue', role: 'operative', connected: true },
]

function game(over: Partial<GameState> = {}): GameState {
	return {
		cards: [],
		startingTeam: 'red',
		currentTeam: 'red',
		phase: 'clue',
		clue: null,
		guessesRemaining: 0,
		prevClueWord: { red: null, blue: null },
		winner: null,
		log: [],
		...over,
	}
}

describe('validateIntent', () => {
	it('капитан текущей команды может дать подсказку в фазе clue', () => {
		assert.equal(validateIntent(roster, game(), 'rs', { type: 'GIVE_CLUE', word: 'x', count: 1 }), true)
	})

	it('капитан другой команды не может дать подсказку', () => {
		assert.equal(validateIntent(roster, game(), 'bs', { type: 'GIVE_CLUE', word: 'x', count: 1 }), false)
	})

	it('игрок не может давать подсказку', () => {
		assert.equal(validateIntent(roster, game(), 'ro', { type: 'GIVE_CLUE', word: 'x', count: 1 }), false)
	})

	it('игрок текущей команды может открывать карту в фазе guess', () => {
		const g = game({ phase: 'guess' })
		assert.equal(validateIntent(roster, g, 'ro', { type: 'REVEAL_CARD', index: 0 }), true)
	})

	it('капитан не может открывать карты', () => {
		const g = game({ phase: 'guess' })
		assert.equal(validateIntent(roster, g, 'rs', { type: 'REVEAL_CARD', index: 0 }), false)
	})

	it('игрок другой команды не может открывать карту', () => {
		const g = game({ phase: 'guess' })
		assert.equal(validateIntent(roster, g, 'bo', { type: 'REVEAL_CARD', index: 0 }), false)
	})

	it('нельзя дать подсказку в фазе guess и открыть карту в фазе clue', () => {
		assert.equal(
			validateIntent(roster, game({ phase: 'guess' }), 'rs', {
				type: 'GIVE_CLUE',
				word: 'x',
				count: 1,
			}),
			false,
		)
		assert.equal(validateIntent(roster, game({ phase: 'clue' }), 'ro', { type: 'REVEAL_CARD', index: 0 }), false)
	})

	it('игрок текущей команды может завершить ход в guess', () => {
		assert.equal(validateIntent(roster, game({ phase: 'guess' }), 'ro', { type: 'END_TURN' }), true)
	})

	it('неизвестный отправитель отклоняется', () => {
		assert.equal(validateIntent(roster, game(), 'xxx', { type: 'GIVE_CLUE', word: 'x', count: 1 }), false)
	})

	it('в завершённой игре любые интенты отклоняются', () => {
		const over = game({ phase: 'over', winner: 'red' })
		assert.equal(validateIntent(roster, over, 'rs', { type: 'GIVE_CLUE', word: 'x', count: 1 }), false)
	})
})
