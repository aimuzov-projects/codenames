const KEY = 'codenames.device'

let cached: string | null = null

/**
 * Стабильный идентификатор устройства — он же игровой id участника. Переживает разрыв связи и
 * перезапуск приложения, поэтому хост узнаёт вернувшегося игрока и сажает его на прежнее место
 * с той же командой и ролью (см. приём `hello` в net.ts), а не заводит дубль.
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
		// приватный режим / нет доступа — id проживёт до перезагрузки
	}

	const id = crypto.randomUUID().slice(0, 8)

	cached = id

	try {
		localStorage.setItem(KEY, id)
	} catch {
		// см. выше
	}

	return id
}
