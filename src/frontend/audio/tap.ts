import { resumeAudio, sfxTap } from '#frontend/audio/sfx.ts'
import { soundEnabledAtom } from '#frontend/state/settings.ts'

/**
 * Light feedback on a button press: a quiet click.
 * Gated by the sound setting; called on pointerdown (fires before click → more responsive).
 */
export function tapFeedback(): void {
	if (soundEnabledAtom()) {
		resumeAudio()
		sfxTap()
	}
}
