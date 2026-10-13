/**
 * WS relay address: same host, path /ws. In prod Caddy routes it to the relay, locally the
 * Astro proxy does (see astro.config.mjs), so the server address isn't hardcoded anywhere.
 */
export function relayUrl(): string {
	const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
	return `${scheme}//${location.host}/ws`
}
