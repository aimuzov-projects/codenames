/**
 * Адрес WS-релея: тот же хост, путь /ws. На проде его отдаёт релею Caddy, локально -- прокси
 * Astro (см. astro.config.mjs), поэтому адрес сервера нигде не зашит.
 */
export function relayUrl(): string {
	const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
	return `${scheme}//${location.host}/ws`
}
