/** Team. */
export type Team = 'red' | 'blue'

/** Card type (the secret key). */
export type CardType = 'red' | 'blue' | 'neutral' | 'assassin'

/** Player role. */
export type Role = 'spymaster' | 'operative'

/** Game phase. */
export type GamePhase = 'clue' | 'guess' | 'over'

/** Card on the board. */
export type Card = {
	word: string
	/** True card type: a secret known only to spymasters. */
	type: CardType
	revealed: boolean
	/** Team that revealed the card (public fact). undefined while the card is hidden. */
	openedBy?: Team
}

/** Spymaster's active clue. */
export type Clue = {
	word: string
	/** Number of related words (>= 1). */
	count: number
	team: Team
}

/** Full game state (canonical, kept by the host). */
export type GameState = {
	cards: Card[]
	/** Team with 9 cards (goes first). */
	startingTeam: Team
	/** Whose turn it is. */
	currentTeam: Team
	phase: GamePhase
	clue: Clue | null
	/** How many more cards can be revealed this turn. */
	guessesRemaining: number
	/** Each team's clue word from its previous turn (for the bonus). null until it has had a turn. */
	prevClueWord: Record<Team, string | null>
	/** Winning team (if the game is over). */
	winner: Team | null
	/** Game timeline: clues, reveals, turn passes (for the stats screen). */
	log: LogEntry[]
}

/** Game creation config. */
export type GameConfig = {
	/** Word pool (>= 25 unique). 25 of them are picked at random. */
	words: string[]
	/** Starting team. If not set, RNG picks it. */
	startingTeam?: Team
}

/** Source of randomness: a function returning a number in [0, 1). */
export type Rng = () => number

/** Events that change the game (applied by the pure reducer). */
export type GameEvent =
	{ type: 'GIVE_CLUE'; word: string; count: number } | { type: 'REVEAL_CARD'; index: number } | { type: 'END_TURN' }

/**
 * Game timeline entry. Accumulates in `GameState.log` (see the reducer).
 * Contains only public facts, so it's safe to broadcast to guests.
 * `at` is the timestamp (ms epoch), set by whoever applies the event.
 */
export type LogEntry =
	| { kind: 'clue'; team: Team; word: string; count: number; at: number }
	/** Card reveal: `team` is who revealed it, `type` is the true type (already public). */
	| { kind: 'reveal'; team: Team; word: string; type: CardType; at: number }
	/** Voluntary end of turn. */
	| { kind: 'pass'; team: Team; at: number }

/** Card in its role-redacted view. */
export type RedactedCard = {
	word: string
	/** Card type, or null if it's hidden from this role. */
	type: CardType | null
	revealed: boolean
	/** Team that revealed the card, or undefined for hidden ones. */
	openedBy?: Team
}

/** State redacted for a specific role (sent to clients). */
export type RedactedState = Omit<GameState, 'cards'> & { cards: RedactedCard[] }
