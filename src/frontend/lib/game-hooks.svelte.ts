import { fromStore } from 'svelte/store'

import { sfxReveal, sfxWin } from '#frontend/audio/sfx.ts'
import type { RedactedState } from '#frontend/game/index.ts'
import { toast } from '#frontend/lib/toast.ts'
import { endTurnLockLeft, turnSecondsLeft, turnStartedAt } from '#frontend/lib/turn-timer.ts'
import { endTurn, type Mode } from '#frontend/state/session.ts'
import { soundEnabledAtom, timerSecondsAtom } from '#frontend/state/settings.ts'

/** За сколько секунд до конца хода предупреждаем, что время заканчивается. */
const TURN_WARN_SECONDS = 20

/** На сколько секунд блокируется «Завершить ход» в начале хода -- гасит случайный тап при передаче телефона. */
const END_TURN_LOCK_SECONDS = 5

/** Звук на открытие карт и завершение партии. Вызывать при инициализации компонента. */
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

		// Меньше открытых, чем было → новая партия: без звуков.
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
 * Обратный отсчёт хода. `fraction` -- доля оставшегося времени 0..1 (или null, если таймера нет).
 * Хост и локаль по истечении сами завершают ход.
 */
export function turnTimer(view: () => RedactedState | null, mode: () => Mode) {
	const timerSec = fromStore(timerSecondsAtom)
	let left = $state<number | null>(null)

	// Старт хода берём из лога партии (см. turnStartedAt): он переживает перемонтирование доски
	// и синхронизируется гостям, поэтому заход в настройки и обратно не перезапускает отсчёт.
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
		// Предупреждаем один раз за ход. Если на момент маунта время уже на исходе (короткий ход
		// или вернулись из настроек под конец) -- повторно не тревожим.
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
		/** 1 в начале хода, 0 в конце. */
		get fraction(): number | null {
			return left === null || !timerSec.current ? null : left / timerSec.current
		},
	}
}

/**
 * Блокировка кнопки «Завершить ход» в начале хода. `left` -- целое число секунд до разблокировки
 * (0 -- кнопка доступна) для показа отсчёта на кнопке. Якорь -- старт хода (turnStartedAt), а не
 * маунт: возврат из настроек отсчёт не перезапускает, а слишком долгая передача телефона застанет
 * кнопку уже открытой.
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

		if (initial <= 0) return // блокировка уже истекла -- интервал не нужен

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
