import type { Card, Team } from '#frontend/game/types.ts'

export const otherTeam = (team: Team): Team => (team === 'red' ? 'blue' : 'red')

/** How many of the team's cards are still unrevealed. */
export function remainingFor(cards: readonly Card[], team: Team): number {
	return cards.filter((c) => c.type === team && !c.revealed).length
}

/** The team with all its cards revealed (the winner), or null. */
export function detectWinner(cards: readonly Card[]): Team | null {
	if (remainingFor(cards, 'red') === 0) return 'red'

	if (remainingFor(cards, 'blue') === 0) return 'blue'

	return null
}

/** Current score: how many cards each team has left to reveal. */
export function score(cards: readonly Card[]): Record<Team, number> {
	return { red: remainingFor(cards, 'red'), blue: remainingFor(cards, 'blue') }
}
