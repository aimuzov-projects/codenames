import { readFileSync } from 'node:fs'
import sitemap from '@astrojs/sitemap'
import svelte from '@astrojs/svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'astro/config'

import pwa from './src/frontend/integrations/pwa.ts'

const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'))

// На проде /ws отдаёт Caddy релею, локально его роль играет прокси Vite: и в dev, и в preview.
const proxy = { '/ws': { target: 'ws://localhost:8787', ws: true } }

export default defineConfig({
	// Рядом с игрой в src/ лежат WS-релей и общий с ним протокол.
	srcDir: './src/frontend',
	// Абсолютные ссылки в canonical, og:url и sitemap.
	site: 'https://codenames.aimuzov.online',
	// CSS немного: внутри HTML он не блокирует первую отрисовку отдельным запросом.
	build: { inlineStylesheets: 'always' },
	// Игра -- одно Svelte-приложение на главной, сервис-воркер для офлайна собирает pwa().
	integrations: [svelte(), sitemap(), pwa()],
	// Подсветка Shiki несовместима с CSP.
	markdown: { syntaxHighlight: false },
	// Astro кладёт CSP с хешами своих скриптов и стилей в <meta> страницы. Снаружи ничего:
	// релей на том же хосте (wss: нужен из-за схемы), QR рисуется в data:, камера -- blob:.
	// frame-ancestors в <meta> не действует, встраивание запрещает X-Frame-Options в Caddy.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				"img-src 'self' data: blob:",
				"media-src 'self' blob:",
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
	vite: {
		// Версия и время сборки видны в настройках: по ним понятно, обновилось ли устройство.
		define: {
			__APP_VERSION__: JSON.stringify(version),
			__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
		},
		// HTTPS в dev и preview: камера и сервис-воркер работают только в защищённом контексте,
		// в том числе когда с телефона заходят по локальной сети.
		plugins: [basicSsl()],
		server: { proxy },
		preview: { proxy },
	},
})
