/**
 * Edge swipe from the left edge of the screen to the right → "back".
 * Listens to touch on `window` without `preventDefault`, so vertical scrolling isn't disturbed.
 * A gesture started on an interactive element (button, field) is ignored.
 * Returns an unsubscribe: the screen's $effect calls it on unmount.
 */
export function edgeSwipeBack(onBack: () => void): () => void {
	const EDGE_ZONE = 30 // px from the left edge where the gesture may start
	const THRESHOLD = 70 // px of horizontal travel to the right to trigger
	const MAX_DURATION = 600 // ms: a "swipe" slower than this isn't counted as a gesture

	let active = false
	let startX = 0
	let startY = 0
	let startT = 0

	const onStart = (e: TouchEvent) => {
		const t = e.touches[0]

		active = false

		if (e.touches.length !== 1 || !t || t.clientX > EDGE_ZONE) return

		// Don't hijack a gesture started on an interactive element (the "back" button etc.).
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
