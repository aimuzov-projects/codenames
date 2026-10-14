import type { RedactedState } from '#frontend/game/index.ts'

/**
 * Timestamp (ms epoch) of the current turn start: the moment the active clue was given,
 * taken from the game log. This anchor lives in the game state: it syncs
 * to guests and survives the screen remounting, so, unlike a component's local
 * countdown, it doesn't reset when going to settings and back.
 * null: no active turn (not the guess phase).
 */
export function turnStartedAt(view: RedactedState | null): number | null {
	if (!view || view.phase !== 'guess' || !view.clue) return null

	for (let i = view.log.length - 1; i >= 0; i--) {
		const entry = view.log[i]!

		if (entry.kind === 'clue') return entry.at
	}

	return null
}

/** Seconds left in the turn for duration `timerSec` and start `startedAt` (all in ms epoch). */
export function turnSecondsLeft(startedAt: number, timerSec: number, now: number): number {
	return Math.max(0, timerSec - (now - startedAt) / 1000)
}

/**
 * Seconds left until the "End turn" button unlocks.
 * The lock lasts `lockSec` seconds from the turn start `startedAt` (all in ms epoch),
 * to absorb an accidental tap while handing the phone over. 0: the button is already available.
 */
export function endTurnLockLeft(startedAt: number, lockSec: number, now: number): number {
	return Math.max(0, lockSec - (now - startedAt) / 1000)
}
