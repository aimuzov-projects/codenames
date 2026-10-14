import { readFileSync } from 'node:fs'
import sitemap from '@astrojs/sitemap'
import svelte from '@astrojs/svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'astro/config'

import pwa from './src/frontend/integrations/pwa.ts'

const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'))

// In prod Caddy hands /ws to the relay, locally the Vite proxy plays that role: both in dev and preview.
const proxy = { '/ws': { target: 'ws://localhost:8787', ws: true } }

export default defineConfig({
	// Next to the game, src/ holds the WS relay and the protocol shared with it.
	srcDir: './src/frontend',
	// Absolute links in canonical, og:url and sitemap.
	site: 'https://codenames.aimuzov.online',
	// There's little CSS: inlined into HTML it doesn't block the first paint with a separate request.
	build: { inlineStylesheets: 'always' },
	// The game is a single Svelte app on the index page, pwa() builds the service worker for offline.
	integrations: [svelte(), sitemap(), pwa()],
	// Shiki highlighting is incompatible with CSP.
	markdown: { syntaxHighlight: false },
	// Astro puts a CSP with hashes of its scripts and styles into the page <meta>. Nothing external:
	// the relay is on the same host (wss: is needed because of the scheme), QR is drawn into data:, camera is blob:,
	// Vite inlines small font files into data:.
	// frame-ancestors has no effect in <meta>, embedding is blocked by X-Frame-Options in Caddy.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				"img-src 'self' data: blob:",
				"media-src 'self' blob:",
				"font-src 'self' data:",
				"connect-src 'self' wss: ws:",
				"worker-src 'self'",
				"manifest-src 'self'",
				"object-src 'none'",
				"base-uri 'self'",
				"form-action 'self'",
			],
		},
	},
	server: { host: true },
	// The dev toolbar sits at the bottom edge and covers the game buttons, e2e included.
	devToolbar: { enabled: false },
	vite: {
		// Build version and time are shown in settings: they tell whether the device has updated.
		define: {
			__APP_VERSION__: JSON.stringify(version),
			__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
		},
		// HTTPS in dev and preview: the camera and the service worker only work in a secure context,
		// including when a phone connects over the local network. e2e opens the build on localhost,
		// which is a secure context over plain HTTP too, and the infra-site-kit preset expects http.
		plugins: process.env.PUBLIC_E2E === '1' ? [] : [basicSsl()],
		server: { proxy },
		preview: { proxy },
	},
})
