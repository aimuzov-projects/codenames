import { atom } from '#frontend/lib/atom.ts'

export type ToastType = 'success' | 'error' | 'warning' | 'loading'

export type Toast = {
	id: number
	type: ToastType
	title: string
	description?: string
}

type Options = {
	/** Обновить уже показанный тост: «проверяю» сменяется результатом на том же месте. */
	id?: number
	description?: string
}

/** Сколько тост висит; загрузка висит, пока её не сменят результатом. */
const DURATION_MS = 4000

/** Показанные сейчас тосты, их рендерит `components/ui/toaster.svelte`. */
export const toastsAtom = atom<Toast[]>([])

let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

/** Убирает тост сразу, не дожидаясь таймера. */
export function dismissToast(id: number) {
	clearTimeout(timers.get(id))
	timers.delete(id)
	toastsAtom.set(toastsAtom().filter((t) => t.id !== id))
}

function show(type: ToastType, title: string, options: Options = {}): number {
	const id = options.id ?? nextId++
	const next: Toast = { id, type, title, description: options.description }
	const list = toastsAtom()

	toastsAtom.set(list.some((t) => t.id === id) ? list.map((t) => (t.id === id ? next : t)) : [...list, next])
	// Тост обновили -- таймер прежнего показа сбрасываем, иначе он закроет новый текст раньше срока.
	clearTimeout(timers.get(id))

	if (type !== 'loading')
		timers.set(
			id,
			setTimeout(() => dismissToast(id), DURATION_MS),
		)

	return id
}

/**
 * Показ тостов. Каждый метод возвращает `id`: по нему тост можно обновить
 * (передать в `options.id`) или закрыть через {@link dismissToast}.
 */
export const toast = {
	success: (title: string, options?: Options) => show('success', title, options),
	error: (title: string, options?: Options) => show('error', title, options),
	warning: (title: string, options?: Options) => show('warning', title, options),
	loading: (title: string, options?: Options) => show('loading', title, options),
}
