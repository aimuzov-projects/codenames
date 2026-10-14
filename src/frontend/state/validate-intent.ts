import type { GameEvent, GameState, Role } from '#frontend/game/index.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

/**
 * Checks on the host whether the sender may perform the action:
 * the clue is given by the current team's spymaster in the clue phase, cards are revealed
 * and the turn is ended by a current team operative in the guess phase.
 */
export function validateIntent(roster: PlayerInfo[], game: GameState, senderId: string, event: GameEvent): boolean {
	if (game.phase === 'over') return false

	const sender = roster.find((p) => p.id === senderId)

	if (!sender || sender.team !== game.currentTeam) return false

	const requirePhase = (phase: GameState['phase'], role: Role) => game.phase === phase && sender.role === role

	switch (event.type) {
		case 'GIVE_CLUE':
			return requirePhase('clue', 'spymaster')
		case 'REVEAL_CARD':
		case 'END_TURN':
			return requirePhase('guess', 'operative')
	}
}
