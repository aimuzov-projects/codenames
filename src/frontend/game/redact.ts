import type { GameState, RedactedCard, RedactedState, Role } from '#frontend/game/types.ts'

/**
 * Prepares the state for sending to a player with the given role.
 * The spymaster sees the whole key; a player sees the type only of already revealed cards.
 * This is the anti-cheat boundary: hidden colors never leave the host for players.
 */
export function redactStateForRole(state: GameState, role: Role): RedactedState {
	const cards: RedactedCard[] = state.cards.map((c) => ({
		word: c.word,
		revealed: c.revealed,
		type: role === 'spymaster' || c.revealed ? c.type : null,
		openedBy: c.openedBy,
	}))

	return { ...state, cards }
}
