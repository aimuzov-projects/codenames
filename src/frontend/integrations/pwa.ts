import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { generateSW } from 'workbox-build'

/**
 * Сервис-воркер для офлайна: после сборки Workbox прекэширует всё из dist -- оболочку, словари,
 * шрифты, иконки. Игра по QR не ходит в сеть вовсе, так что приложению хватает кэша.
 * Манифест лежит статикой в public/manifest.webmanifest, регистрирует воркер state/pwa.ts.
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
					// Любой адрес открывает игру: экраны переключаются внутри приложения.
					navigateFallback: '/index.html',
					// Новая версия берёт управление сразу, страница перезагрузится сама (см. state/pwa.ts).
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
