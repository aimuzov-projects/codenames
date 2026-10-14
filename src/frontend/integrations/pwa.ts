import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { generateSW } from 'workbox-build'

/**
 * Offline service worker: after the build Workbox precaches everything in dist -- the shell, dictionaries,
 * fonts, icons. A QR game never touches the network, so the cache is all the app needs.
 * The manifest is static in public/manifest.webmanifest; the worker is registered by state/pwa.ts.
 */
export default function pwa(): AstroIntegration {
	return {
		name: 'codenames-pwa',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir)
				const { count, size, warnings } = await generateSW({
					globDirectory: root,
					globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
					globIgnores: ['404.html', 'sitemap-*.xml'],
					swDest: `${root}/sw.js`,
					// Any URL opens the game: screens switch inside the app.
					navigateFallback: '/index.html',
					// A new version takes over right away, the page reloads itself (see state/pwa.ts).
					skipWaiting: true,
					clientsClaim: true,
					cleanupOutdatedCaches: true,
					sourcemap: false,
				})

				for (const warning of warnings) logger.warn(warning)

				logger.info(`sw.js: ${count} файлов, ${Math.round(size / 1024)} КБ в прекэше`)
			},
		},
	}
}
