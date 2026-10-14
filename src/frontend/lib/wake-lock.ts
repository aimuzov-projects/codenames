/**
 * Не даёт экрану гаснуть, пока идёт игра. Причина не в удобстве: уснувшее устройство
 * замораживает вебвью, и соединение с хостом умирает по ICE-таймауту — вернуться в партию
 * можно только новым рукопожатием. Блокировку система снимает при уходе в фон, поэтому
 * берём её заново при каждом возврате на вкладку. Возвращает функцию, снимающую блокировку.
 */
export function keepScreenAwake(): () => void {
	if (!('wakeLock' in navigator)) return () => {}

	let lock: WakeLockSentinel | null = null
	let stopped = false

	const acquire = async () => {
		if (stopped || lock || document.visibilityState !== 'visible') return

		try {
			const sentinel = await navigator.wakeLock.request('screen')

			// Пока ждали ответ системы, блокировку уже успели снять (сменился экран
			// или выключили настройку), поэтому полученную сразу отпускаем, иначе
			// экран так и не будет гаснуть.
			if (stopped) {
				void sentinel.release()

				return
			}

			lock = sentinel

			sentinel.addEventListener('release', () => {
				if (lock === sentinel) lock = null
			})
		} catch {
			// нет поддержки или отказ системы — играем без блокировки
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
