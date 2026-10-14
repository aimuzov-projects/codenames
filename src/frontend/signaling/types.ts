/** Минимальное описание WebRTC-сигнала (структурно совместимо с RTCSessionDescriptionInit). */
export type SignalDescription = {
	type: 'offer' | 'answer'
	sdp: string
}

/**
 * Псевдоним под имя DOM-типа: исторически codec работал с ним.
 * Сейчас внутри проекта не используется.
 */
export type RTCSessionDescriptionInit = SignalDescription
