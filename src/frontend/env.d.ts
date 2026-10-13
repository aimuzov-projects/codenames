/// <reference types="astro/client" />

// Подставляются через vite.define в astro.config.mjs.
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

// Только interface: переменные дописываются к типу Astro слиянием объявлений.
// oxlint-disable-next-line typescript/consistent-type-definitions
interface ImportMetaEnv {
	/** '1' в e2e-прогоне (Playwright): открывает тест-хуки сигналинга. В проде не задан. */
	readonly PUBLIC_E2E?: string
}
