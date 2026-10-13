/// <reference types="astro/client" />

// Injected via vite.define in astro.config.mjs.
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

// Interface only: the variables are added to Astro's type through declaration merging.
// oxlint-disable-next-line typescript/consistent-type-definitions
interface ImportMetaEnv {
	/** '1' in an e2e run (Playwright): enables the signaling test hooks. Not set in production. */
	readonly PUBLIC_E2E?: string
}
