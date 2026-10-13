import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. We run against `astro dev` (not preview): dev has no service worker, so there's no
 * stale PWA cache problem between runs. The dev server is on self-signed HTTPS
 * (basic-ssl), hence `ignoreHTTPSErrors`. PUBLIC_E2E=1 enables the signaling test hooks
 * (see src/frontend/lib/e2e.ts).
 *
 * A single Chromium project with mobile emulation: the app is a phone PWA, plus WebRTC loopback
 * between two contexts is the most predictable in Chromium.
 */
const PORT = 4321
const baseURL = `https://localhost:${PORT}`
// The relay is on the same port as in prod behind Caddy; the dev server proxies /ws to it.
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
		// Network tests wait for a real WebRTC handshake, actions shouldn't rush.
		actionTimeout: 10_000,
	},

	projects: [
		{
			name: 'mobile-chromium',
			use: {
				...devices['Pixel 7'],
				// WebRTC between two contexts on one machine. By default Chromium hides local IPs behind
				// mDNS (*.local, they don't resolve in headless) and offers no loopback candidate, and on a
				// machine behind a VPN the only host candidate turns out to be the VPN interface, over which
				// the two sockets can't connect. The flags expose real IPs and allow loopback (127.0.0.1),
				// so both peers find a direct path.
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
			// Without --ignore-lock Astro notices the AI agent, moves the dev server to the background and exits,
			// and Playwright treats that as a crash.
			command: 'npm run dev -- --ignore-lock',
			url: baseURL,
			// Online mode tests run against a local relay (see the neighboring webServer).
			env: { PUBLIC_E2E: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			command: 'node src/backend/server.ts',
			url: `http://localhost:${RELAY_PORT}`,
			// The relay answers a plain GET by refusing the upgrade, for Playwright that's a sign of life.
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
})
