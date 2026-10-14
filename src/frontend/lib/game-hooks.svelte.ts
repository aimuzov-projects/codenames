import { fromStore } from 'svelte/store'

import { sfxReveal, sfxWin } from '#frontend/audio/sfx.ts'
import type { RedactedState } from '#frontend/game/index.ts'
import { toast } from '#frontend/lib/toast.ts'
import { endTurnLockLeft, turnSecondsLeft, turnStartedAt } from '#frontend/lib/turn-timer.ts'
import { endTurn, type Mode } from '#frontend/state/session.ts'
import { soundEnabledAtom, timerSecondsAtom } from '#frontend/state/settings.ts'

/** How many seconds before the turn ends we warn that time is running out. */
const TURN_WARN_SECONDS = 20

/** How long "End turn" stays locked at the start of a turn: absorbs an accidental tap when handing the phone over. */
const END_TURN_LOCK_SECONDS = 5

/** Sound on card reveals and game end. Call during component initialization. */
export function gameFeedback(view: () => RedactedState | null) {
	let prevRevealed = new Set<number>()
	let prevOver = false

	$effect(() => {
		const current = view()

		if (!current) {
			prevRevealed = new Set()
			prevOver = false

			return
		}

		const now = new Set<number>()
		const newly: number[] = []

		current.cards.forEach((c, i) => {
			if (c.revealed) {
				now.add(i)

				if (!prevRevealed.has(i)) newly.push(i)
			}
		})

		// Fewer revealed than before → a new game: no sounds.
		const isReset = now.size < prevRevealed.size

		if (!isReset) {
			for (const i of newly) {
				const type = current.cards[i]!.type

				if (!type) continue

				if (soundEnabledAtom()) sfxReveal(type)
			}
		}

		prevRevealed = now

		const over = current.phase === 'over'

		if (over && !prevOver && !isReset && soundEnabledAtom()) sfxWin()

		prevOver = over
	})
}

/**
 * Turn countdown. `fraction` is the share of time left, 0..1 (or null if there's no timer).
 * The host and local mode end the turn themselves when it runs out.
 */
export function turnTimer(view: () => RedactedState | null, mode: () => Mode) {
	const timerSec = fromStore(timerSecondsAtom)
	let left = $state<number | null>(null)

	// The turn start comes from the game log (see turnStartedAt): it survives the board remounting
	// and syncs to guests, so going to settings and back doesn't restart the countdown.
	const startedAt = $derived(turnStartedAt(view()))

	$effect(() => {
		const sec = timerSec.current
		const start = startedAt
		const currentMode = mode()

		if (!sec || start == null) {
			left = null

			return
		}

		const remaining = () => turnSecondsLeft(start, sec, Date.now())

		left = remaining()
		// Warn once per turn. If time is already running out at mount (a short turn
		// or came back from settings near the end), don't alarm again.
		let warned = remaining() <= TURN_WARN_SECONDS
		const id = setInterval(() => {
			const rem = remaining()

			left = rem

			if (!warned && rem <= TURN_WARN_SECONDS) {
				warned = true

				toast.warning('Время на ход заканчивается', {
					description: `Осталось ${TURN_WARN_SECONDS} секунд`,
				})
			}

			if (rem <= 0) {
				clearInterval(id)

				if (currentMode !== 'guest') endTurn()
			}
		}, 250)

		return () => clearInterval(id)
	})

	return {
		/** 1 at the start of the turn, 0 at the end. */
		get fraction(): number | null {
			return left === null || !timerSec.current ? null : left / timerSec.current
		},
	}
}

/**
 * Lock on the "End turn" button at the start of a turn. `left` is whole seconds until unlock
 * (0: the button is available), for the countdown on the button. Anchored to the turn start
 * (turnStartedAt), not the mount: coming back from settings doesn't restart the countdown, and a
 * handover that takes too long finds the button already unlocked.
 */
export function endTurnLock(view: () => RedactedState | null) {
	let left = $state(0)
	const startedAt = $derived(turnStartedAt(view()))

	$effect(() => {
		const start = startedAt

		if (start == null) {
			left = 0

			return
		}

		const remaining = () => Math.ceil(endTurnLockLeft(start, END_TURN_LOCK_SECONDS, Date.now()))
		const initial = remaining()

		left = initial

		if (initial <= 0) return // the lock has already expired: no interval needed

		const id = setInterval(() => {
			const rem = remaining()

			left = rem

			if (rem <= 0) clearInterval(id)
		}, 250)

		return () => clearInterval(id)
	})

	return {
		get left() {
			return left
		},
	}
}
