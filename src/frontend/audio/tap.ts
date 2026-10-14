import { resumeAudio, sfxTap } from '#frontend/audio/sfx.ts'
import { soundEnabledAtom } from '#frontend/state/settings.ts'

/**
 * Лёгкий отклик на нажатие кнопки: тихий клик.
 * Гейтится настройкой звука; зовётся на pointerdown (раньше click → отзывчивее).
 */
export function tapFeedback(): void {
	if (soundEnabledAtom()) {
		resumeAudio()
		sfxTap()
	}
}
