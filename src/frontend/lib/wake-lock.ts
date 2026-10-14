/**
 * Keeps the screen on while a game is running. The reason isn't convenience: a sleeping device
 * freezes the webview, and the connection to the host dies on ICE timeout, so the only way back
 * into the game is a new handshake. The system releases the lock when going to background, so
 * we take it again on every return to the tab. Returns a function that releases the lock.
 */
export function keepScreenAwake(): () => void {
	if (!('wakeLock' in navigator)) return () => {}

	let lock: WakeLockSentinel | null = null
	let stopped = false

	const acquire = async () => {
		if (stopped || lock || document.visibilityState !== 'visible') return

		try {
			const sentinel = await navigator.wakeLock.request('screen')

			if (stopped) {
				void sentinel.release()

				return
			}

			lock = sentinel

			sentinel.addEventListener('release', () => {
				if (lock === sentinel) lock = null
			})
		} catch {
			// no support or the system refused: play without the lock
		}
	}

	void acquire()
	document.addEventListener('visibilitychange', acquire)

	return () => {
		stopped = true
		document.removeEventListener('visibilitychange', acquire)
		void lock?.release()
		lock = null
	}
}
