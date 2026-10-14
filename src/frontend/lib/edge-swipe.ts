/**
 * Edge-swipe от левого края экрана вправо → «назад».
 * Слушает touch на `window` без `preventDefault`, чтобы не мешать вертикальному скроллу.
 * Жест, начатый на интерактивном элементе (кнопка, поле), игнорируется.
 * Возвращает отписку: её зовёт $effect экрана при размонтировании.
 */
export function edgeSwipeBack(onBack: () => void): () => void {
	const EDGE_ZONE = 30 // px от левого края, где жест может начаться
	const THRESHOLD = 70 // px горизонтального хода вправо для срабатывания
	const MAX_DURATION = 600 // ms — слишком медленный «свайп» жестом не считаем

	let active = false
	let startX = 0
	let startY = 0
	let startT = 0

	const onStart = (e: TouchEvent) => {
		const t = e.touches[0]

		active = false

		if (e.touches.length !== 1 || !t || t.clientX > EDGE_ZONE) return

		// Не перехватываем жест, начатый на интерактивном элементе (кнопка «назад» и т.п.).
		const target = e.target as Element | null

		if (target?.closest?.('button, a, input, textarea, select, [role="button"], [role="slider"]')) {
			return
		}

		active = true
		startX = t.clientX
		startY = t.clientY
		startT = e.timeStamp
	}

	const onEnd = (e: TouchEvent) => {
		if (!active) return

		active = false
		const t = e.changedTouches[0]

		if (!t) return

		const dx = t.clientX - startX
		const dy = t.clientY - startY

		if (dx >= THRESHOLD && dx > Math.abs(dy) && e.timeStamp - startT <= MAX_DURATION) {
			onBack()
		}
	}

	const reset = () => {
		active = false
	}

	window.addEventListener('touchstart', onStart, { passive: true })
	window.addEventListener('touchend', onEnd, { passive: true })
	window.addEventListener('touchcancel', reset, { passive: true })

	return () => {
		window.removeEventListener('touchstart', onStart)
		window.removeEventListener('touchend', onEnd)
		window.removeEventListener('touchcancel', reset)
	}
}
