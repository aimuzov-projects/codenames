import { toast } from 'svelte-sonner'

import { atom } from '#frontend/lib/atom.ts'

/** Версия и время сборки (подставляются через vite.define в astro.config.mjs). */
export const APP_VERSION = __APP_VERSION__
export const BUILD_TIME = __BUILD_TIME__

/** Состояние ручной проверки обновления — только чтобы крутить спиннер на кнопке. Результат показываем тостом. */
export type UpdateStatus = 'idle' | 'checking' | 'updating'
export const updateStatusAtom = atom<UpdateStatus>('idle')

let registration: ServiceWorkerRegistration | undefined

/**
 * Регистрирует сервис-воркер (его собирает integrations/pwa.ts на build). Новый воркер сразу
 * берёт управление (skipWaiting + clientsClaim), а страница перезагружается на смене
 * контроллера -- так игроки не застревают на старой версии. В dev воркера нет.
 */
export function registerServiceWorker() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
	// Первый захват контроллера на чистой установке -- не обновление, перезагружать незачем.
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
			// без воркера приложение работает, только не офлайн
		})
}

/** Принудительно проверяет обновление приложения и применяет его, если найдено. */
export async function checkForUpdate() {
	updateStatusAtom.set('checking')
	const toastId = toast.loading('Проверяю обновление…')
	try {
		await registration?.update()
		// Новый воркер уже устанавливается или ждёт -- он сам возьмёт управление и перезагрузит страницу.
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
