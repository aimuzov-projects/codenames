/**
 * e2e run flag (PUBLIC_E2E=1). Under it the signaling screens render test hooks
 * (a hidden offer/answer code and a field to type it in instead of the camera), so Playwright can
 * run a real WebRTC host↔guest handshake without a camera. In prod the flag isn't set, so the
 * hooks don't appear and behavior doesn't change. Unit tests (plain Node) have no import.meta.env.
 */
export const E2E = import.meta.env?.PUBLIC_E2E === '1'
