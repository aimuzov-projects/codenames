/** Minimal WebRTC signal description (structurally compatible with RTCSessionDescriptionInit). */
export type SignalDescription = {
	type: 'offer' | 'answer'
	sdp: string
}

// Alias for readability in codec (historically a DOM type was used here).
export type RTCSessionDescriptionInit = SignalDescription
