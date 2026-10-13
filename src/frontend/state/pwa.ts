import { atom } from '#frontend/lib/atom.ts'
import { toast } from '#frontend/lib/toast.ts'

/** Build version and time (injected via vite.define in astro.config.mjs). */
export const APP_VERSION = __APP_VERSION__
export const BUILD_TIME = __BUILD_TIME__

/** Manual update check state, only to spin the button's spinner. The result is shown as a toast. */
export type UpdateStatus = 'idle' | 'checking' | 'updating'
export const updateStatusAtom = atom<UpdateStatus>('idle')

let registration: ServiceWorkerRegistration | undefined

/**
 * Registers the service worker (built by integrations/pwa.ts on build). A new worker takes
 * control right away (skipWaiting + clientsClaim), and the page reloads on controller
 * change, so players don't get stuck on an old version. There's no worker in dev.
 */
export function registerServiceWorker() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
	// The first controller claim on a fresh install isn't an update, no reason to reload.
	let reloading = !navigator.serviceWorker.controller
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading) {
			reloading = false
			return
		}
		reloading = true
		location.reload()
	})
	navigator.serviceWorker
		.register('/sw.js')
		.then((r) => (registration = r))
		.catch(() => {
			// the app works without the worker, just not offline
		})
}

/** Forces an app update check and applies the update if one is found. */
export async function checkForUpdate() {
	updateStatusAtom.set('checking')
	const toastId = toast.loading('Проверяю обновление…')
	try {
		await registration?.update()
		// A new worker is already installing or waiting, it'll take control and reload the page itself.
		if (registration?.installing || registration?.waiting) {
			updateStatusAtom.set('updating')
			toast.loading('Найдено обновление, перезагружаю…', { id: toastId })
		} else {
			toast.success('Установлена последняя версия', { id: toastId })
			updateStatusAtom.set('idle')
		}
	} catch {
		toast.error('Не удалось проверить обновление', { id: toastId })
		updateStatusAtom.set('idle')
	}
}
