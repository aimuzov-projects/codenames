import type { Rng } from '#frontend/game/types.ts'

/** Fisher–Yates shuffle on an injected RNG (pure, doesn't mutate the input). */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
	const a = arr.slice()
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const tmp = a[i]!
		a[i] = a[j]!
		a[j] = tmp
	}
	return a
}
