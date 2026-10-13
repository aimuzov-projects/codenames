import { derived, writable, type Readable } from 'svelte/store'

/**
 * Атом -- стор Svelte, который ещё и читается вызовом: `count()` вместо `get(count)`. В компонентах
 * это обычный стор (`$count`), а в логике состояния чтение не требует подписки. Модули состояния
 * не зависят от компилятора Svelte и поэтому гоняются в `node --test` как есть.
 */
export type Atom<T> = Readable<T> & {
	(): T
	set(value: T): void
}

export type Computed<T> = Readable<T> & {
	(): T
}

export function atom<T>(initial: T): Atom<T> {
	let value = initial
	const store = writable(initial)
	const read = () => value
	return Object.assign(read, {
		subscribe: store.subscribe,
		set(next: T) {
			value = next
			store.set(next)
		},
	})
}

/**
 * Производное значение. Источники перечисляются явно: по ним стор узнаёт, когда пересчитаться
 * для подписчиков, а вызов `fn()` всегда считает по свежим значениям.
 */
export function computed<T>(sources: Readable<unknown>[], fn: () => T): Computed<T> {
	const store = derived(sources, () => fn())
	return Object.assign(() => fn(), { subscribe: store.subscribe })
}

/** Вызывает `cb` на каждое изменение стора, но не на подписку (текущее значение). */
export function onChange(store: Readable<unknown>, cb: () => void): () => void {
	let initial = true
	return store.subscribe(() => {
		if (initial) {
			initial = false
			return
		}
		cb()
	})
}
