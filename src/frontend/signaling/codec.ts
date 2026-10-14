import { deflateRaw, inflateRaw } from 'pako'

import { base45Decode, base45Encode } from '#frontend/signaling/base45.ts'
import { expandSdp, isMinifiedSignal, minifySdp } from '#frontend/signaling/sdp.ts'
import type { SignalDescription } from '#frontend/signaling/types.ts'

/**
 * Encodes a WebRTC signal into a compact string for QR.
 *
 * Steps: SDP minification (only the essential fields + filtered candidates) →
 * deflate compression (the hex fingerprint and boilerplate parts of candidates squeeze well) →
 * Base45 packing (QR uses the dense alphanumeric mode). Thanks to this
 * the QR is noticeably easier for a camera to scan.
 */
export function encodeSignal(desc: SignalDescription): string {
	return base45Encode(deflateRaw(minifySdp(desc)))
}

/** Decodes the string back into a WebRTC signal. */
export function decodeSignal(text: string): SignalDescription {
	const trimmed = text.trim()

	// Compatibility: a bare minified code (M~…) without compression.
	if (isMinifiedSignal(trimmed)) return expandSdp(trimmed)

	return expandSdp(inflateRaw(base45Decode(trimmed), { to: 'string' }))
}
