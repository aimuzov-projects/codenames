import { detectWinner, otherTeam } from '#frontend/game/rules.ts'
import type { Card, GameEvent, GameState, LogEntry } from '#frontend/game/types.ts'

/**
 * Pure game reducer: applies an event and returns the new state.
 * On top of the result it appends a timeline entry (`log`); `at` is the timestamp
 * (ms epoch) set by whoever applies the event (0 by default in tests).
 */
export function reducer(state: GameState, event: GameEvent, at = 0): GameState {
	if (state.phase === 'over') return state
	const next = apply(state, event)
	// Same ref: the event is invalid or changed nothing, leave the log alone.
	if (next === state) return state
	const entry = logEntryFor(state, event, at)
	return entry ? { ...next, log: [...next.log, entry] } : next
}

/** Applies the event without logging (the old pure logic). */
function apply(state: GameState, event: GameEvent): GameState {
	switch (event.type) {
		case 'GIVE_CLUE':
			return giveClue(state, event.word, event.count)
		case 'REVEAL_CARD':
			return revealCard(state, event.index)
		case 'END_TURN':
			return state.phase === 'guess' ? endTurn(state) : state
	}
}

/**
 * Timeline entry for the applied event, based on the state BEFORE it
 * (that's where the revealing team and the revealed card type are visible). Called only
 * when the event actually changed the state.
 */
function logEntryFor(state: GameState, event: GameEvent, at: number): LogEntry | null {
	switch (event.type) {
		case 'GIVE_CLUE':
			return { kind: 'clue', team: state.currentTeam, word: event.word, count: event.count, at }
		case 'REVEAL_CARD': {
			const card = state.cards[event.index]!
			return { kind: 'reveal', team: state.currentTeam, word: card.word, type: card.type, at }
		}
		case 'END_TURN':
			return { kind: 'pass', team: state.currentTeam, at }
	}
}

function giveClue(state: GameState, word: string, count: number): GameState {
	if (state.phase !== 'clue') return state
	if (!word.trim() || !Number.isInteger(count) || count < 1) return state
	return {
		...state,
		clue: { word, count, team: state.currentTeam },
		phase: 'guess',
		guessesRemaining: count + 1,
	}
}

function revealCard(state: GameState, index: number): GameState {
	if (state.phase !== 'guess') return state
	const target = state.cards[index]
	if (!target || target.revealed) return state

	const cards: Card[] = state.cards.map((c, i) =>
		i === index ? { ...c, revealed: true, openedBy: state.currentTeam } : c,
	)

	// Assassin: instant loss for the revealing team.
	if (target.type === 'assassin') {
		return {
			...state,
			cards,
			phase: 'over',
			winner: otherTeam(state.currentTeam),
			guessesRemaining: 0,
		}
	}

	// Revealed some team's last card: that team wins (even if the opponent revealed it).
	const winner = detectWinner(cards)
	if (winner) {
		return { ...state, cards, phase: 'over', winner, guessesRemaining: 0 }
	}

	// Correct card of your own team: spend a guess, the turn goes on while guesses remain.
	if (target.type === state.currentTeam) {
		const guessesRemaining = state.guessesRemaining - 1
		return guessesRemaining > 0 ? { ...state, cards, guessesRemaining } : { ...endTurn(state), cards }
	}

	// Neutral or opponent's card: the turn passes.
	return { ...endTurn(state), cards }
}

/** Passing the turn: switch team, reset the clue and guesses. */
function endTurn(state: GameState): GameState {
	return {
		...state,
		currentTeam: otherTeam(state.currentTeam),
		phase: 'clue',
		clue: null,
		guessesRemaining: 0,
		// Remember the given clue as this team's "previous" one: it's shown in the team's next bonus.
		prevClueWord: state.clue ? { ...state.prevClueWord, [state.clue.team]: state.clue.word } : state.prevClueWord,
	}
}
