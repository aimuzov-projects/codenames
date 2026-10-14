import { atom } from '#frontend/lib/atom.ts'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'codenames.theme'

function load(): ThemeMode {
	try {
		const v = localStorage.getItem(KEY)

		return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
	} catch {
		return 'system'
	}
}

export const themeAtom = atom<ThemeMode>(load())

const media =
	typeof window !== 'undefined' && typeof window.matchMedia === 'function'
		? window.matchMedia('(prefers-color-scheme: dark)')
		: null

function resolveDark(mode: ThemeMode): boolean {
	if (mode === 'dark') return true

	if (mode === 'light') return false

	return media?.matches ?? false
}

/** Applies the theme to <html>: `.dark` class for dark (taking the system mode into account). */
export function applyTheme(mode: ThemeMode = themeAtom()): void {
	document.documentElement.classList.toggle('dark', resolveDark(mode))
}

export function setTheme(mode: ThemeMode) {
	themeAtom.set(mode)

	try {
		localStorage.setItem(KEY, mode)
	} catch {
		// private mode / no access: the theme just won't be saved
	}

	applyTheme(mode)
}

// Follow system theme changes while the "System" mode is selected.
media?.addEventListener('change', () => {
	if (themeAtom() === 'system') applyTheme('system')
})
