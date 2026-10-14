import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reducer } from '#frontend/game/reducer.ts'
import type { Card, CardType, GameState } from '#frontend/game/types.ts'

/** Строит поле из явного списка типов. Слова — w0, w1, ... */
function board(types: CardType[]): Card[] {
	return types.map((type, i) => ({ word: `w${i}`, type, revealed: false }))
}

/** Базовое состояние в фазе подсказки для red. */
function clueState(types: CardType[]): GameState {
	return {
		cards: board(types),
		startingTeam: 'red',
		currentTeam: 'red',
		phase: 'clue',
		clue: null,
		guessesRemaining: 0,
		prevClueWord: { red: null, blue: null },
		winner: null,
		log: [],
	}
}

/** Состояние в фазе угадывания (после подсказки count). */
function guessState(types: CardType[], count: number): GameState {
	return {
		...clueState(types),
		phase: 'guess',
		clue: { word: 'подсказка', count, team: 'red' },
		guessesRemaining: count + 1,
	}
}

// Удобный мини-расклад: индексы 0,1 — red; 2,3 — blue; 4 — neutral; 5 — assassin.
const LAYOUT: CardType[] = ['red', 'red', 'blue', 'blue', 'neutral', 'assassin']

describe('reducer / GIVE_CLUE', () => {
	it('в фазе подсказки задаёт подсказку и переводит в угадывание с count+1 попытками', () => {
		const next = reducer(clueState(LAYOUT), { type: 'GIVE_CLUE', word: 'река', count: 2 })

		assert.equal(next.phase, 'guess')
		assert.deepEqual(next.clue, { word: 'река', count: 2, team: 'red' })
		assert.equal(next.guessesRemaining, 3)
	})

	it('игнорируется вне фазы подсказки', () => {
		const s = guessState(LAYOUT, 1)

		assert.equal(reducer(s, { type: 'GIVE_CLUE', word: 'x', count: 1 }), s)
	})

	it('игнорирует некорректный count (< 1) и пустое слово', () => {
		const s = clueState(LAYOUT)

		assert.equal(reducer(s, { type: 'GIVE_CLUE', word: 'x', count: 0 }), s)
		assert.equal(reducer(s, { type: 'GIVE_CLUE', word: '  ', count: 2 }), s)
	})
})

describe('reducer / REVEAL_CARD', () => {
	it('верная карта своей команды открывается и тратит попытку, ход продолжается', () => {
		const next = reducer(guessState(LAYOUT, 2), { type: 'REVEAL_CARD', index: 0 })

		assert.equal(next.cards[0]!.revealed, true)
		assert.equal(next.phase, 'guess')
		assert.equal(next.currentTeam, 'red')
		assert.equal(next.guessesRemaining, 2)
	})

	it('исчерпание попыток на верной карте передаёт ход (без победы)', () => {
		// 3 красных, чтобы открытие двух не завершило команду. count=1 -> 2 попытки.
		const s = guessState(['red', 'red', 'red', 'blue', 'neutral', 'assassin'], 1)
		const afterFirst = reducer(s, { type: 'REVEAL_CARD', index: 0 }) // 1 попытка осталась
		const afterSecond = reducer(afterFirst, { type: 'REVEAL_CARD', index: 1 }) // 0 -> пас

		assert.equal(afterSecond.phase, 'clue')
		assert.equal(afterSecond.currentTeam, 'blue')
		assert.equal(afterSecond.clue, null)
		assert.equal(afterSecond.guessesRemaining, 0)
	})

	it('нейтральная карта завершает ход', () => {
		const next = reducer(guessState(LAYOUT, 3), { type: 'REVEAL_CARD', index: 4 })

		assert.equal(next.cards[4]!.revealed, true)
		assert.equal(next.phase, 'clue')
		assert.equal(next.currentTeam, 'blue')
		assert.equal(next.clue, null)
	})

	it('карта соперника открывается и завершает ход', () => {
		const next = reducer(guessState(LAYOUT, 3), { type: 'REVEAL_CARD', index: 2 })

		assert.equal(next.cards[2]!.revealed, true)
		assert.equal(next.currentTeam, 'blue')
		assert.equal(next.phase, 'clue')
	})

	it('ассасин — мгновенный проигрыш, побеждает соперник', () => {
		const next = reducer(guessState(LAYOUT, 3), { type: 'REVEAL_CARD', index: 5 })

		assert.equal(next.phase, 'over')
		assert.equal(next.winner, 'blue')
		assert.equal(next.cards[5]!.revealed, true)
	})

	it('открытие последней карты своей команды — победа', () => {
		// Откроем index 0 заранее, останется одна красная (index 1)
		const s = guessState(LAYOUT, 3)
		const opened: GameState = {
			...s,
			cards: s.cards.map((c, i) => (i === 0 ? { ...c, revealed: true } : c)),
		}
		const next = reducer(opened, { type: 'REVEAL_CARD', index: 1 })

		assert.equal(next.phase, 'over')
		assert.equal(next.winner, 'red')
	})

	it('открытие последней карты соперника отдаёт победу сопернику', () => {
		const s = guessState(LAYOUT, 3)
		const opened: GameState = {
			...s,
			cards: s.cards.map((c, i) => (i === 2 ? { ...c, revealed: true } : c)),
		}
		const next = reducer(opened, { type: 'REVEAL_CARD', index: 3 })

		assert.equal(next.phase, 'over')
		assert.equal(next.winner, 'blue')
	})

	it('игнорирует уже открытую карту, неверный индекс и фазу не-угадывания', () => {
		const s = guessState(LAYOUT, 2)
		const opened: GameState = {
			...s,
			cards: s.cards.map((c, i) => (i === 0 ? { ...c, revealed: true } : c)),
		}

		assert.equal(reducer(opened, { type: 'REVEAL_CARD', index: 0 }), opened)
		assert.equal(reducer(s, { type: 'REVEAL_CARD', index: 99 }), s)
		const cs = clueState(LAYOUT)

		assert.equal(reducer(cs, { type: 'REVEAL_CARD', index: 0 }), cs)
	})
})

describe('reducer / END_TURN', () => {
	it('в угадывании передаёт ход и очищает подсказку', () => {
		const next = reducer(guessState(LAYOUT, 2), { type: 'END_TURN' })

		assert.equal(next.phase, 'clue')
		assert.equal(next.currentTeam, 'blue')
		assert.equal(next.clue, null)
		assert.equal(next.guessesRemaining, 0)
	})

	it('игнорируется вне фазы угадывания', () => {
		const s = clueState(LAYOUT)

		assert.equal(reducer(s, { type: 'END_TURN' }), s)
	})

	it('запоминает поданную подсказку как прошлую для этой команды (для бонуса)', () => {
		const afterClue = reducer(clueState(LAYOUT), { type: 'GIVE_CLUE', word: 'река', count: 2 })

		// В первый ход прошлой подсказки ещё нет.
		assert.equal(afterClue.prevClueWord.red, null)
		// После передачи хода запоминаем «реку» как прошлую подсказку красных.
		const afterTurn = reducer(afterClue, { type: 'END_TURN' })

		assert.equal(afterTurn.prevClueWord.red, 'река')
		assert.equal(afterTurn.prevClueWord.blue, null)
	})
})

describe('reducer / общее', () => {
	it('игнорирует любые события в завершённой игре', () => {
		const over: GameState = { ...clueState(LAYOUT), phase: 'over', winner: 'red' }

		assert.equal(reducer(over, { type: 'GIVE_CLUE', word: 'x', count: 1 }), over)
		assert.equal(reducer(over, { type: 'REVEAL_CARD', index: 0 }), over)
		assert.equal(reducer(over, { type: 'END_TURN' }), over)
	})

	it('не мутирует входное состояние', () => {
		const s = guessState(LAYOUT, 2)
		const snapshot = JSON.stringify(s)

		reducer(s, { type: 'REVEAL_CARD', index: 0 })
		assert.equal(JSON.stringify(s), snapshot)
	})
})

describe('reducer / log (таймлайн)', () => {
	it('GIVE_CLUE добавляет запись подсказки с командой, словом и числом', () => {
		const next = reducer(clueState(LAYOUT), { type: 'GIVE_CLUE', word: 'река', count: 2 }, 1000)

		assert.deepEqual(next.log, [{ kind: 'clue', team: 'red', word: 'река', count: 2, at: 1000 }])
	})

	it('невалидная подсказка не добавляет запись в лог', () => {
		const s = clueState(LAYOUT)

		assert.deepEqual(reducer(s, { type: 'GIVE_CLUE', word: '  ', count: 2 }).log, [])
		assert.deepEqual(reducer(s, { type: 'GIVE_CLUE', word: 'x', count: 0 }).log, [])
	})

	it('REVEAL_CARD добавляет запись открытия с истинным типом и открывшей командой', () => {
		const next = reducer(guessState(LAYOUT, 2), { type: 'REVEAL_CARD', index: 0 }, 2000)

		assert.deepEqual(next.log, [{ kind: 'reveal', team: 'red', word: 'w0', type: 'red', at: 2000 }])
	})

	it('повторное открытие карты не добавляет запись в лог', () => {
		const s = guessState(LAYOUT, 2)
		const opened: GameState = {
			...s,
			cards: s.cards.map((c, i) => (i === 0 ? { ...c, revealed: true } : c)),
		}

		assert.equal(reducer(opened, { type: 'REVEAL_CARD', index: 0 }), opened)
	})

	it('явный END_TURN в угадывании добавляет запись «пас»', () => {
		const next = reducer(guessState(LAYOUT, 2), { type: 'END_TURN' }, 3000)

		assert.deepEqual(next.log, [{ kind: 'pass', team: 'red', at: 3000 }])
	})

	it('авто-передача хода после неверной карты не создаёт лишний «пас» (только открытие)', () => {
		// index 4 — нейтральная, ход переходит автоматически.
		const next = reducer(guessState(LAYOUT, 3), { type: 'REVEAL_CARD', index: 4 })

		assert.deepEqual(next.log, [{ kind: 'reveal', team: 'red', word: 'w4', type: 'neutral', at: 0 }])
	})

	it('накапливает записи по ходу партии в порядке событий', () => {
		const s0 = clueState(LAYOUT)
		const s1 = reducer(s0, { type: 'GIVE_CLUE', word: 'река', count: 2 }, 100)
		const s2 = reducer(s1, { type: 'REVEAL_CARD', index: 0 }, 200) // верная red, ход продолжается
		const s3 = reducer(s2, { type: 'REVEAL_CARD', index: 4 }, 300) // нейтральная, пас

		assert.deepEqual(s3.log, [
			{ kind: 'clue', team: 'red', word: 'река', count: 2, at: 100 },
			{ kind: 'reveal', team: 'red', word: 'w0', type: 'red', at: 200 },
			{ kind: 'reveal', team: 'red', word: 'w4', type: 'neutral', at: 300 },
		])
	})
})
