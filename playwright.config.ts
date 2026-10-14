import preset from '@aimuzov-projects/infra-site-kit/playwright'
import { defineConfig, devices } from '@playwright/test'

/**
 * The e2e preset of infra-site-kit: Chromium against `astro build && astro preview` on plain HTTP.
 * PUBLIC_E2E=1 reaches the preset's build through the environment: it enables the signaling test hooks
 * (see src/frontend/lib/e2e.ts) and turns off basic-ssl (see astro.config.mjs).
 */
process.env.PUBLIC_E2E = '1'

// The relay is on the same port as in prod behind Caddy; the preview server proxies /ws to it.
const RELAY_PORT = 8787

export default defineConfig(preset, {
	// The network tests open several contexts with a real WebRTC handshake each, in parallel they
	// starve each other of CPU and time out.
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	expect: { timeout: 10_000 },

	use: {
		// Network tests wait for a real WebRTC handshake, actions shouldn't rush.
		actionTimeout: 10_000,
	},

	// The preset's project, emulating a phone: the app is a phone PWA.
	projects: [
		{
			name: 'chromium',
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

	// Online mode tests run against a local relay next to the preview.
	webServer: {
		command: 'node src/backend/server.ts',
		// The relay answers a plain GET by refusing the upgrade, for Playwright that's a sign of life.
		url: `http://localhost:${RELAY_PORT}`,
		reuseExistingServer: false,
	},
})
