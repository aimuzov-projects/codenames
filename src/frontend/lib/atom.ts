import { derived, writable, type Readable } from 'svelte/store'

/**
 * Atom: a Svelte store that can also be read by calling it, `count()` instead of `get(count)`. In components
 * it's a regular store (`$count`), and in state logic reading needs no subscription. State modules
 * don't depend on the Svelte compiler, so they run in `node --test` as is.
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
 * Derived value. Sources are listed explicitly: they tell the store when to recompute
 * for subscribers, while calling `fn()` always computes from fresh values.
 */
export function computed<T>(sources: Readable<unknown>[], fn: () => T): Computed<T> {
	const store = derived(sources, () => fn())

	return Object.assign(() => fn(), { subscribe: store.subscribe })
}

/** Calls `cb` on every store change, but not on subscribe (the current value). */
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
