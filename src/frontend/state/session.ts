import {
	createGame,
	redactStateForRole,
	reducer,
	type GameConfig,
	type GameEvent,
	type GameState,
	type RedactedState,
	type Role,
	type Team,
} from '#frontend/game/index.ts'
import { atom, computed } from '#frontend/lib/atom.ts'

/**
 * Session layer. Three modes:
 *  - 'local'  — single device (hot-seat): canonical state in gameAtom, the key behind a button.
 *  - 'host'   — network host: canonical state in gameAtom, state broadcast to guests (see net.ts).
 *  - 'guest'  — network client: renders remoteViewAtom, intents go to the host.
 */
export type Mode = 'local' | 'host' | 'guest'

export const modeAtom = atom<Mode>('local')

/** Canonical game state (local/host modes). */
export const gameAtom = atom<GameState | null>(null)

/** State received from the host (guest mode). */
export const remoteViewAtom = atom<RedactedState | null>(null)

/** Player's assigned role (network modes). */
export const myRoleAtom = atom<Role>('operative')
export const myTeamAtom = atom<Team>('red')

/** Role the board is edited/shown as. */
export const viewRoleAtom = atom<Role>('operative')

/**
 * Why the turn passes to the spymaster (hot-seat): which wrong word was revealed last turn.
 * Shown in the pass-the-phone popup. null means game start or the turn was ended voluntarily.
 */
export const handoffReasonAtom = atom<{ word: string; type: 'neutral' | Team } | null>(null)

/**
 * Holds popups back while the card reveal animation plays. While true, the pass-the-phone
 * gate (PassPhone) and the win overlay (Board) are hidden, so the reveal reaction plays
 * out first (fill + check/cross, see CardTile).
 */
export const revealLockedAtom = atom(false)

/** Popup delay after a card click, matched to the reveal animation length. */
const REVEAL_POPUP_DELAY_MS = 1500

export const isHostAtom = computed([modeAtom], () => modeAtom() !== 'guest')

/** What the UI shows. */
export const viewAtom = computed<RedactedState | null>([modeAtom, remoteViewAtom, gameAtom, viewRoleAtom], () => {
	if (modeAtom() === 'guest') return remoteViewAtom()
	const game = gameAtom()
	return game ? redactStateForRole(game, viewRoleAtom()) : null
})

/** Score from public info only (revealed cards + the known 9/8 split). */
export const scoreAtom = computed<Record<Team, number>>([viewAtom], () => {
	const view = viewAtom()
	if (!view) return { red: 0, blue: 0 }
	const totalRed = view.startingTeam === 'red' ? 9 : 8
	const totalBlue = view.startingTeam === 'blue' ? 9 : 8
	const revealed = (team: Team) => view.cards.filter((c) => c.revealed && c.type === team).length
	return { red: totalRed - revealed('red'), blue: totalBlue - revealed('blue') }
})

export const isOverAtom = computed([viewAtom], () => viewAtom()?.phase === 'over')

// --- Network hooks (registered by net.ts to avoid a circular dependency) ---
let intentSender: ((event: GameEvent) => void) | null = null
let hostSubmit: ((senderId: string, event: GameEvent) => void) | null = null

export function setIntentSender(fn: ((event: GameEvent) => void) | null) {
	intentSender = fn
}
export function setHostSubmit(fn: ((senderId: string, event: GameEvent) => void) | null) {
	hostSubmit = fn
}

/** Applies the event to the canonical state (local/host only). Returns true if there is a state. */
export function applyEvent(event: GameEvent) {
	const game = gameAtom()
	if (!game) return false
	gameAtom.set(reducer(game, event, Date.now()))
	return true
}

/** Player action from the UI. Routed by mode. */
const playerAction = (event: GameEvent) => {
	const mode = modeAtom()
	if (mode === 'guest') {
		intentSender?.(event)
	} else if (mode === 'host') {
		hostSubmit?.('host', event) // the host is a player too, with id 'host'
	} else {
		applyEvent(event)
	}
}

export function startGame(config: GameConfig) {
	gameAtom.set(createGame(config))
	viewRoleAtom.set('operative')
	handoffReasonAtom.set(null)
}

export function giveClue(word: string, count: number) {
	playerAction({ type: 'GIVE_CLUE', word, count })
	if (modeAtom() === 'local') viewRoleAtom.set('operative') // hot-seat: hide the key
}

export function revealCard(index: number) {
	const before = gameAtom()
	playerAction({ type: 'REVEAL_CARD', index })
	if (modeAtom() === 'local' && before?.phase === 'guess') {
		const after = gameAtom()
		const card = after?.cards[index]
		const turnPassed = !!after && after.phase === 'clue' && after.currentTeam !== before.currentTeam
		// The turn passed because of a wrong card (opponent's or neutral, not the assassin), show it in the popup.
		handoffReasonAtom.set(
			turnPassed && card && card.type !== before.currentTeam && card.type !== 'assassin'
				? { word: card.word, type: card.type as 'neutral' | Team }
				: null,
		)
		// Hold the popup (turn handoff / win) until the card reveal animation is over.
		if (turnPassed || after?.phase === 'over') {
			revealLockedAtom.set(true)
			setTimeout(() => revealLockedAtom.set(false), REVEAL_POPUP_DELAY_MS)
		}
	}
}

export function endTurn() {
	handoffReasonAtom.set(null)
	playerAction({ type: 'END_TURN' })
}
