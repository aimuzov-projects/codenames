import { defineConfig, devices } from '@playwright/test'

/**
 * E2E-конфиг. Гоняем против `astro dev` (а не preview): в dev сервис-воркера нет, поэтому нет
 * проблемы с устаревшим PWA-кэшем между прогонами. Dev-сервер на самоподписанном HTTPS
 * (basic-ssl) -- отсюда `ignoreHTTPSErrors`. PUBLIC_E2E=1 включает тест-хуки сигналинга
 * (см. src/frontend/lib/e2e.ts).
 *
 * Один проект Chromium с мобильной эмуляцией: приложение — PWA под телефон, плюс WebRTC-loopback
 * между двумя контекстами в Chromium самый предсказуемый.
 */
const PORT = 4321
const baseURL = `https://localhost:${PORT}`
// Релей на том же порту, что и на проде за Caddy; dev-сервер проксирует к нему /ws.
const RELAY_PORT = 8787

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
	timeout: 30_000,
	expect: { timeout: 10_000 },

	use: {
		baseURL,
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		// Сетевые тесты ждут реального WebRTC-рукопожатия — действия не должны спешить.
		actionTimeout: 10_000,
	},

	projects: [
		{
			name: 'mobile-chromium',
			use: {
				...devices['Pixel 7'],
				// WebRTC между двумя контекстами на одной машине. По умолчанию Chromium прячет локальные
				// IP за mDNS (*.local, в headless не резолвятся) и не предлагает loopback-кандидат, а на
				// машине за VPN единственным host-кандидатом оказывается VPN-интерфейс, по которому два
				// сокета не связываются. Флаги раскрывают реальные IP и разрешают loopback (127.0.0.1) —
				// тогда оба пира находят прямой путь.
				launchOptions: {
					args: [
						'--disable-features=WebRtcHideLocalIpsWithMdns',
						'--allow-loopback-in-peer-connection',
						'--force-webrtc-ip-handling-policy=default',
					],
				},
			},
		},
	],

	webServer: [
		{
			// Без --ignore-lock Astro, заметив AI-агента, уводит dev-сервер в фон и сразу выходит,
			// а Playwright считает это падением.
			command: 'npm run dev -- --ignore-lock',
			url: baseURL,
			env: { PUBLIC_E2E: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			command: 'node src/backend/server.ts',
			url: `http://localhost:${RELAY_PORT}`,
			// На обычный GET релей отвечает `ok <число комнат>`, для Playwright это признак жизни.
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
})
