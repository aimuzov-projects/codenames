import { defineConfig, devices } from '@playwright/test'

/**
 * E2E-конфиг. Гоняем против `vite dev` (а не preview): в dev сервис-воркер выключен
 * (`devOptions.enabled: false`), поэтому нет проблемы с устаревшим PWA-кэшем между прогонами.
 * Dev-сервер на самоподписанном HTTPS (basic-ssl) — отсюда `ignoreHTTPSErrors`.
 * VITE_E2E=1 включает тест-хуки сигналинга (см. src/lib/e2e.ts).
 *
 * Один проект Chromium с мобильной эмуляцией: приложение — PWA под телефон, плюс WebRTC-loopback
 * между двумя контекстами в Chromium самый предсказуемый.
 */
const PORT = 5173
const baseURL = `https://localhost:${PORT}`

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

	webServer: {
		command: 'npm run dev',
		url: baseURL,
		env: { VITE_E2E: '1' },
		ignoreHTTPSErrors: true,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
})
