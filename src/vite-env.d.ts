/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Шрифтовой пакет — это CSS-импорт без типов.
declare module '@fontsource-variable/manrope'

// Подставляются через define в vite.config.ts.
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
	/** '1' в e2e-прогоне (Playwright): открывает тест-хуки сигналинга. В проде не задан. */
	readonly VITE_E2E?: string
	/** Адрес WS-релея (wss://…/ws). Не задан — игра работает только офлайн, по QR. */
	readonly VITE_RELAY_URL?: string
}
