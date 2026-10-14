const KEY = 'codenames.device'

let cached: string | null = null

/**
 * Stable device id, which is also the player's game id. It survives a dropped connection and
 * an app restart, so the host recognizes a returning player and puts them back in their old seat
 * with the same team and role (see `hello` handling in net.ts) instead of creating a duplicate.
 */
export function deviceId(): string {
	if (cached) return cached

	try {
		const saved = localStorage.getItem(KEY)

		if (saved) {
			cached = saved

			return saved
		}
	} catch {
		// private mode / no access: the id lives until reload
	}

	const id = crypto.randomUUID().slice(0, 8)

	cached = id

	try {
		localStorage.setItem(KEY, id)
	} catch {
		// see above
	}

	return id
}
