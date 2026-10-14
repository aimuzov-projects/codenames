// Theme before the bundle loads: the startup loader and first frame don't flash white in dark theme.
// applyTheme() in state/theme.ts repeats the same logic. A file rather than an inline script:
// Astro doesn't hash is:inline scripts for its CSP, so an inline body gets blocked, while a
// same-origin file passes through 'self'.
try {
	const t = localStorage.getItem('codenames.theme')
	const dark = t === 'dark' || ((t === 'system' || !t) && matchMedia('(prefers-color-scheme: dark)').matches)

	if (dark) document.documentElement.classList.add('dark')
} catch {}
