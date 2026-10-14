import { shuffle } from '#frontend/game/random.ts'
import type { Card, CardType, GameConfig, GameState, Rng, Team } from '#frontend/game/types.ts'

export const BOARD_SIZE = 25
const STARTING_TEAM_CARDS = 9
const SECOND_TEAM_CARDS = 8
const NEUTRAL_CARDS = 7
const ASSASSIN_CARDS = 1

const other = (team: Team): Team => (team === 'red' ? 'blue' : 'red')

/**
 * Creates a new game: takes 25 words from the pool, deals the 9/8/7/1 key in favor of
 * the starting team, sets the clue phase. RNG is injected for tests.
 */
export function createGame(config: GameConfig, rng: Rng = Math.random): GameState {
	const uniqueWords = [...new Set(config.words)]

	if (uniqueWords.length < BOARD_SIZE) {
		throw new Error(`Нужно минимум ${BOARD_SIZE} уникальных слов, получено ${uniqueWords.length}`)
	}

	const startingTeam: Team = config.startingTeam ?? (rng() < 0.5 ? 'red' : 'blue')

	const words = shuffle(uniqueWords, rng).slice(0, BOARD_SIZE)
	const types = shuffle(buildKey(startingTeam), rng)

	const cards: Card[] = words.map((word, i) => ({
		word,
		type: types[i]!,
		revealed: false,
	}))

	return {
		cards,
		startingTeam,
		currentTeam: startingTeam,
		phase: 'clue',
		clue: null,
		guessesRemaining: 0,
		prevClueWord: { red: null, blue: null },
		winner: null,
		log: [],
	}
}

/** List of 25 card types per the Codenames layout. */
function buildKey(startingTeam: Team): CardType[] {
	return [
		...Array<CardType>(STARTING_TEAM_CARDS).fill(startingTeam),
		...Array<CardType>(SECOND_TEAM_CARDS).fill(other(startingTeam)),
		...Array<CardType>(NEUTRAL_CARDS).fill('neutral'),
		...Array<CardType>(ASSASSIN_CARDS).fill('assassin'),
	]
}
